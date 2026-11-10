import {
  ExecutionCalculator,
  floorLeverage,
  OrderbookLevel,
  StandardizedOrderbook,
} from "../models";

const BASE_URL = "https://tradingapi.mainnet.bullet.xyz";
const META_TTL_MS = 300_000;
const DEPTH_LIMIT = 1000;

interface BulletMarketMeta {
  market_id: number;
  symbol: string;
  base: string;
  taker_fee_bps: number | null;
  maker_fee_bps: number | null;
  max_leverage: number | null;
  active: boolean;
}

function parseFeeBps(arr: unknown): number | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const n = Number(arr[0]);
  return Number.isFinite(n) ? Number(n.toFixed(4)) : null;
}

export class BulletAPI {
  // Veranta-anchored asset key -> Bullet perpetual symbol
  static readonly SYMBOLS: Record<string, string> = {
    // Commodities
    XAU: "GOLD-USD",
    XAG: "SILVER-USD",
    WTI: "WTIOIL-USD",
    BRENT: "BRENTOIL-USD",
    // Indices
    US500: "US500-USD",
    US100: "US100-USD",
    // US & KR Equities
    NVDA: "NVDA-USD",
    TSLA: "TSLA-USD",
    SPCX: "SPCX-USD",
    MU: "MU-USD",
    SNDK: "SNDK-USD",
    SKHY: "SKHYNIX-USD",
  };

  public metaCache: Record<string, BulletMarketMeta> = {};
  private metaTs = 0;

  resolveSymbol(assetOrSymbol: string): string | null {
    const up = assetOrSymbol.toUpperCase();
    if (up in BulletAPI.SYMBOLS) return BulletAPI.SYMBOLS[up];
    if (Object.values(BulletAPI.SYMBOLS).includes(up)) return up;
    if (up.endsWith("-USD")) return up;
    return null;
  }

  async loadMeta(): Promise<void> {
    if (
      Object.keys(this.metaCache).length > 0 &&
      Date.now() - this.metaTs < META_TTL_MS
    ) {
      return;
    }
    try {
      const [exResp, riskResp] = await Promise.all([
        fetch(`${BASE_URL}/fapi/v1/exchangeInfo`, {
          headers: {
            Accept: "application/json",
            "User-Agent": "splitting-comparator/1.0",
          },
          cache: "no-store",
        }),
        fetch(`${BASE_URL}/api/v1/riskEngineConfig`, {
          headers: {
            Accept: "application/json",
            "User-Agent": "splitting-comparator/1.0",
          },
          cache: "no-store",
        }),
      ]);
      if (!exResp.ok) return;
      const exJson = await exResp.json();
      const symbols: any[] = exJson?.symbols || [];
      if (!Array.isArray(symbols) || symbols.length === 0) return;

      let levTables: Record<string, any> = {};
      if (riskResp.ok) {
        try {
          const riskJson = await riskResp.json();
          const v1 = "value" in riskJson ? riskJson.value?.V1 : riskJson?.V1;
          levTables = v1?.margin_config?.V0?.perp_leverage_tables || {};
        } catch {
          // ignore
        }
      }

      const cache: Record<string, BulletMarketMeta> = {};
      for (const s of symbols) {
        const symbol = String(s?.symbol || "").toUpperCase();
        if (!symbol) continue;
        const marketId = Number(s?.marketId);
        const base = String(
          s?.baseAsset || symbol.split("-")[0]
        ).toUpperCase();

        const takerBps = parseFeeBps(s?.takerFeeBps);
        const makerBps = parseFeeBps(s?.makerFeeBps);

        let maxLev: number | null = null;
        const tiers = levTables[String(marketId)]?.tiers;
        if (tiers && typeof tiers === "object") {
          const tier0Lev = floorLeverage(tiers["0"]?.max_leverage);
          if (tier0Lev !== null) {
            maxLev = tier0Lev;
          } else {
            for (const t of Object.values(tiers) as any[]) {
              const lv = floorLeverage(t?.max_leverage);
              if (lv !== null && (maxLev === null || lv > maxLev)) {
                maxLev = lv;
              }
            }
          }
        }

        const entry: BulletMarketMeta = {
          market_id: marketId,
          symbol,
          base,
          taker_fee_bps: takerBps,
          maker_fee_bps: makerBps,
          max_leverage: maxLev,
          active: String(s?.status || "").toUpperCase() === "TRADING",
        };
        cache[symbol] = entry;
        cache[base] = entry;
      }

      if (Object.keys(cache).length > 0) {
        this.metaCache = cache;
        this.metaTs = Date.now();
      }
    } catch {
      // ignore
    }
  }

  private async resolveMarket(
    assetOrSymbol: string
  ): Promise<BulletMarketMeta | null> {
    await this.loadMeta();
    const resolved =
      this.resolveSymbol(assetOrSymbol) || assetOrSymbol.toUpperCase();
    return this.metaCache[resolved] || null;
  }

  async getFees(
    assetOrSymbol: string
  ): Promise<[number | null, number | null]> {
    const meta = await this.resolveMarket(assetOrSymbol);
    if (!meta) return [null, null];
    return [meta.taker_fee_bps, meta.maker_fee_bps];
  }

  async getMaxLeverage(assetOrSymbol: string): Promise<number | null> {
    const meta = await this.resolveMarket(assetOrSymbol);
    return floorLeverage(meta?.max_leverage);
  }

  async getOrderbook(
    assetOrSymbol: string,
    limit: number = DEPTH_LIMIT
  ): Promise<Record<string, any> | null> {
    const symbol =
      this.resolveSymbol(assetOrSymbol) || assetOrSymbol.toUpperCase();
    try {
      const resp = await fetch(
        `${BASE_URL}/fapi/v1/depth?symbol=${encodeURIComponent(
          symbol
        )}&limit=${limit}`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "splitting-comparator/1.0",
          },
          cache: "no-store",
        }
      );
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  }

  normalizeOrderbook(
    orderbook: Record<string, any> | null
  ): StandardizedOrderbook | null {
    if (!orderbook) return null;
    const rawBids = orderbook.bids || [];
    const rawAsks = orderbook.asks || [];
    if (!rawBids.length || !rawAsks.length) return null;

    const parse = (entries: any[]): OrderbookLevel[] =>
      entries
        .map((e) => ({
          price: Number(Array.isArray(e) ? e[0] : e?.price ?? e?.px ?? 0),
          qty: Number(Array.isArray(e) ? e[1] : e?.size ?? e?.sz ?? 0),
        }))
        .filter(
          (e) =>
            Number.isFinite(e.price) &&
            e.price > 0 &&
            Number.isFinite(e.qty) &&
            e.qty > 0
        );

    const bids = parse(rawBids).sort((a, b) => b.price - a.price);
    const asks = parse(rawAsks).sort((a, b) => a.price - b.price);
    if (!bids.length || !asks.length) return null;

    const bestBid = bids[0].price;
    const bestAsk = asks[0].price;
    if (bestBid <= 0 || bestAsk <= 0) return null;

    const rawTs = Number(orderbook.T || orderbook.E);
    let timestamp = Date.now() / 1000;
    if (Number.isFinite(rawTs) && rawTs > 0) {
      if (rawTs > 1e14) {
        timestamp = rawTs / 1e6; // microseconds
      } else if (rawTs > 1e11) {
        timestamp = rawTs / 1e3; // milliseconds
      } else {
        timestamp = rawTs;
      }
    }

    return {
      bids,
      asks,
      best_bid: bestBid,
      best_ask: bestAsk,
      mid_price: (bestBid + bestAsk) / 2,
      timestamp,
    };
  }

  async getOptimalExecution(
    assetOrSymbol: string,
    orderSizeUsd: number
  ): Promise<Record<string, any> | null> {
    const symbol = this.resolveSymbol(assetOrSymbol);
    if (!symbol) return null;

    const [meta, raw] = await Promise.all([
      this.resolveMarket(symbol),
      this.getOrderbook(symbol, DEPTH_LIMIT),
    ]);
    if (!meta || !meta.active || meta.taker_fee_bps === null || !raw) {
      return null;
    }

    const std = this.normalizeOrderbook(raw);
    if (!std) return null;

    const result = ExecutionCalculator.calculateExecutionCost(
      std,
      orderSizeUsd,
      meta.taker_fee_bps,
      meta.taker_fee_bps
    );
    if (!result) return null;

    result.symbol = meta.symbol;
    result.max_leverage = floorLeverage(meta.max_leverage);
    result.fee_bps = meta.taker_fee_bps;
    result.maker_fee_bps = meta.maker_fee_bps;
    result.true_mid = result.mid_price;
    return result;
  }
}
