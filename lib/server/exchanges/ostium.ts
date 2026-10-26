import { floorLeverage } from "../models";

const BASE_URL = "https://metadata-backend.ostium.io";
const PAIRS_URL = "https://app.ostium.com/api/pairs";
const SEASONS_URL = "https://onlypoints.ostium.io/api/seasons/current";

const PRECISION_27 = 1e27;
const PRECISION_18_BI = BigInt("1000000000000000000");
const PRECISION_18_NUM = 1e18;
const PRECISION_10_NUM = 1e10;

function toBigIntSafe(val: unknown): bigint {
  if (val === null || val === undefined) return BigInt(0);
  try {
    const s = String(val).trim();
    if (!s) return BigInt(0);
    if (s.includes(".") || s.includes("e") || s.includes("E")) {
      return BigInt(Math.trunc(Number(s)));
    }
    return BigInt(s);
  } catch {
    return BigInt(0);
  }
}

export class OstiumAPI {
  private metadataCache: Record<string, any> = {};
  private metadataLoadedAt = 0;
  private readonly cacheTtlMs = 300_000;

  private firstPositiveLeverage(values: any[]): number | null {
    for (const v of values) {
      if (v === null || v === undefined) continue;
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) return n / 100.0;
    }
    return null;
  }

  private async ensureMetadataFresh(): Promise<void> {
    if (
      Object.keys(this.metadataCache).length > 0 &&
      Date.now() - this.metadataLoadedAt < this.cacheTtlMs
    ) {
      return;
    }

    const cache: Record<string, any> = {};
    const pairIdMap: Record<string, string> = {};

    try {
      const [pairsRes, seasonsRes] = await Promise.allSettled([
        fetch(PAIRS_URL, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        }),
        fetch(SEASONS_URL, {
          headers: {
            Accept: "application/json",
            Referer: "https://app.ostium.io/",
          },
          cache: "no-store",
        }),
      ]);

      if (pairsRes.status === "fulfilled" && pairsRes.value.ok) {
        const data = await pairsRes.value.json();
        if (Array.isArray(data)) {
          for (const pair of data) {
            const base = pair?.from;
            const quote = pair?.to;
            if (!base || !quote) continue;
            const symbol = `${base}${quote}`;
            if (pair.id != null) {
              pairIdMap[String(pair.id)] = symbol;
            }
            if (pair.takerFeeP == null) continue;
            const takerFeeBps = Number(pair.takerFeeP) / 10000.0;
            const makerFeeBps =
              pair.makerFeeP != null ? Number(pair.makerFeeP) / 10000.0 : 0.0;
            const group = pair.group || {};

            cache[symbol] = {
              fee_bps: takerFeeBps,
              maker_fee_bps: makerFeeBps,
              max_leverage: floorLeverage(
                this.firstPositiveLeverage([
                  pair.maxLeverage,
                  pair.makerMaxLeverage,
                  group.maxLeverage,
                ])
              ),
              price_impact_k:
                pair.priceImpactK != null ? Number(pair.priceImpactK) : null,
              decay_rate_bi: toBigIntSafe(pair.decayRate),
              buy_volume_bi: toBigIntSafe(pair.buyVolume),
              sell_volume_bi: toBigIntSafe(pair.sellVolume),
              last_update_timestamp:
                pair.lastUpdateTimestamp != null
                  ? Number(pair.lastUpdateTimestamp)
                  : null,
              max_oi_usd: Number(pair.maxOI || 0) / 1e6,
              long_oi_raw: Number(pair.longOI || 0),
              short_oi_raw: Number(pair.shortOI || 0),
            };
          }
        }
      }

      if (seasonsRes.status === "fulfilled" && seasonsRes.value.ok) {
        const sData = await seasonsRes.value.json();
        const assets = sData?.season?.mode?.assets;
        if (Array.isArray(assets)) {
          for (const item of assets) {
            if (item?.assetId == null || item?.newFee == null) continue;
            const sym = pairIdMap[String(item.assetId)];
            if (sym && cache[sym]) {
              const newFeeBps = Number(item.newFee) * 100.0;
              cache[sym].fee_bps = newFeeBps;
              cache[sym].maker_fee_bps = newFeeBps;
            }
          }
        }
      }

      if (Object.keys(cache).length > 0) {
        this.metadataCache = cache;
        this.metadataLoadedAt = Date.now();
      }
    } catch {
      // ignore
    }
  }

  private decayVolumeWithPade(
    volume: bigint,
    decayInterval: number,
    decayRate: bigint
  ): bigint {
    if (decayInterval <= 0 || decayRate <= BigInt(0)) return volume;
    const dtBi = BigInt(Math.trunc(decayInterval));
    const decayFactorHalf = (decayRate * dtBi) / BigInt(2);
    const numerator =
      PRECISION_18_BI > decayFactorHalf
        ? PRECISION_18_BI - decayFactorHalf
        : BigInt(0);
    const denominator = PRECISION_18_BI + decayFactorHalf;
    if (denominator === BigInt(0)) return BigInt(0);
    const decayMultiplier = (numerator * PRECISION_18_BI) / denominator;
    return (volume * decayMultiplier) / PRECISION_18_BI;
  }

  private getDecayedVolumesUsd(assetData: Record<string, any>): [number, number] {
    const decayRate: bigint = assetData.decay_rate_bi || BigInt(0);
    const buyVol: bigint = assetData.buy_volume_bi || BigInt(0);
    const sellVol: bigint = assetData.sell_volume_bi || BigInt(0);
    const nowSec = Math.trunc(Date.now() / 1000);
    const lastUpdate = assetData.last_update_timestamp ?? nowSec;
    const dt = Math.max(0, nowSec - lastUpdate);

    const decayedBuy = this.decayVolumeWithPade(buyVol, dt, decayRate);
    const decayedSell = this.decayVolumeWithPade(sellVol, dt, decayRate);

    const scale = 100 * PRECISION_10_NUM;
    return [Number(decayedBuy) / scale, Number(decayedSell) / scale];
  }

  private calculateDynamicSpread(
    notionalUsd: number,
    priceImpactK: number,
    midPrice: number,
    askPrice: number,
    bidPrice: number,
    initialVolumeUsd: number = 0
  ): number {
    const baSpreadBps = ((askPrice - bidPrice) / midPrice) * 10000;
    const marketSpreadHalf = baSpreadBps / 2;
    const avgVolume = initialVolumeUsd + notionalUsd / 2;
    const dynamicSpreadBps =
      ((avgVolume * priceImpactK) / PRECISION_27) * 10000;
    return marketSpreadHalf + dynamicSpreadBps;
  }

  private async getLatestPrice(asset: string): Promise<Record<string, any> | null> {
    const url = `${BASE_URL}/PricePublish/latest-price?asset=${encodeURIComponent(asset)}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Number(data.mid) > 0) return data;
        }
      } catch {
        // retry
      }
    }
    return null;
  }

  private getRemainingOiUsd(
    assetData: Record<string, any>,
    midPrice: number
  ): [number, number] {
    const maxOi = Number(assetData.max_oi_usd || 0);
    const longRaw = Number(assetData.long_oi_raw || 0);
    const shortRaw = Number(assetData.short_oi_raw || 0);
    if (maxOi <= 0 || midPrice <= 0) return [Infinity, Infinity];

    const currentLongUsd = (longRaw / PRECISION_18_NUM) * midPrice;
    const currentShortUsd = (shortRaw / PRECISION_18_NUM) * midPrice;
    return [
      Math.max(0, maxOi - currentLongUsd),
      Math.max(0, maxOi - currentShortUsd),
    ];
  }

  async calculateExecutionCost(
    asset: string,
    orderSizeUsd: number,
    isLong: boolean = true
  ): Promise<Record<string, any> | null> {
    const [rawData] = await Promise.all([
      this.getLatestPrice(asset),
      this.ensureMetadataFresh(),
    ]);
    if (!rawData) return null;

    const midPrice = Number(rawData.mid || 0);
    const bidPrice = Number(rawData.bid || 0);
    const askPrice = Number(rawData.ask || 0);
    if (midPrice <= 0 || bidPrice <= 0 || askPrice <= 0) return null;

    const assetData = this.metadataCache[asset];
    if (!assetData || assetData.fee_bps == null) return null;

    const openFeeBps = Number(assetData.fee_bps);
    const makerFeeBps = Number(assetData.maker_fee_bps || 0);

    const [remainingLong, remainingShort] = this.getRemainingOiUsd(
      assetData,
      midPrice
    );
    const liqCap = isLong ? remainingLong : remainingShort;
    const maxOiUsd = Number(assetData.max_oi_usd || 0);

    const filled = orderSizeUsd <= liqCap;
    const filledUsd =
      Number.isFinite(liqCap) ? Math.min(orderSizeUsd, liqCap) : orderSizeUsd;
    const unfilledUsd = Math.max(0, orderSizeUsd - filledUsd);
    const positionSize = filledUsd;

    const priceImpactK = assetData.price_impact_k;
    const isDynamic = priceImpactK !== null && priceImpactK > 0;
    const baSpreadBps = ((askPrice - bidPrice) / midPrice) * 10000;
    const basicSpreadHalf = baSpreadBps / 2;

    let buySpreadBps = basicSpreadHalf;
    let sellSpreadBps = basicSpreadHalf;
    let avgSpreadBps = basicSpreadHalf;

    if (isDynamic) {
      const [decayedBuyUsd, decayedSellUsd] =
        this.getDecayedVolumesUsd(assetData);
      buySpreadBps = this.calculateDynamicSpread(
        positionSize,
        priceImpactK,
        midPrice,
        askPrice,
        bidPrice,
        decayedBuyUsd
      );
      sellSpreadBps = this.calculateDynamicSpread(
        positionSize,
        priceImpactK,
        midPrice,
        askPrice,
        bidPrice,
        decayedSellUsd
      );
      avgSpreadBps = (buySpreadBps + sellSpreadBps) / 2;
    }

    const buyExecPrice = midPrice * (1 + buySpreadBps / 10000);
    const sellExecPrice = midPrice * (1 - sellSpreadBps / 10000);

    return {
      executed: filled ? true : "PARTIAL",
      filled,
      order_size_usd: orderSizeUsd,
      filled_usd: filledUsd,
      unfilled_usd: unfilledUsd,
      max_order_size: Number.isFinite(liqCap) ? liqCap : maxOiUsd,
      max_oi_usd: maxOiUsd,
      liquidity_cap: Number.isFinite(liqCap) ? liqCap : maxOiUsd,
      mid_price: midPrice,
      best_bid: bidPrice,
      best_ask: askPrice,
      slippage_bps: avgSpreadBps,
      buy_slippage_bps: buySpreadBps,
      sell_slippage_bps: sellSpreadBps,
      fee_bps: openFeeBps,
      maker_fee_bps: makerFeeBps,
      is_market_open: Boolean(rawData.isMarketOpen),
      max_leverage: assetData.max_leverage,
      is_dynamic_spread: isDynamic,
      timestamp: Date.now() / 1000,
      buy: {
        filled,
        filled_usd: filledUsd,
        unfilled_usd: unfilledUsd,
        avg_price: buyExecPrice,
        slippage_bps: buySpreadBps,
        levels_used: 1,
      },
      sell: {
        filled,
        filled_usd: filledUsd,
        unfilled_usd: unfilledUsd,
        avg_price: sellExecPrice,
        slippage_bps: sellSpreadBps,
        levels_used: 1,
      },
    };
  }
}
