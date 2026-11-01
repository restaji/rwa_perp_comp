import {
  ExecutionCalculator,
  floorLeverage,
  OrderbookLevel,
  StandardizedOrderbook,
} from "../models";

const BASE_URL = "https://api.arcus.xyz/v1";
const MARKETS_TTL_MS = 300_000;
const ORDERBOOK_LEVELS = 100;

interface ArcusMarketMeta {
  market_id: number;
  symbol: string;
  base: string;
  taker_fee_bps: number | null;
  maker_fee_bps: number | null;
  max_leverage: number | null;
  active: boolean;
}

function ppmToBps(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Number((n / 100).toFixed(4)) : null;
}

export class ArcusAPI {
  // Veranta-anchored asset key -> Arcus perpetual marketDisplayName
  static readonly SYMBOLS: Record<string, string> = {
    // Commodities (ETF proxies on Arcus COMMODITIES category)
    XAU: "GLD-USD",
    XAG: "SLV-USD",
    WTI: "USO-USD",
    // Indices
    US500: "SPY-USD",
    US100: "QQQ-USD",
    // MAG7 + US/KR Equities
    AAPL: "AAPL-USD",
    MSFT: "MSFT-USD",
    GOOG: "GOOGL-USD",
    AMZN: "AMZN-USD",
    META: "META-USD",
    NVDA: "NVDA-USD",
    TSLA: "TSLA-USD",
    COIN: "COIN-USD",
    HOOD: "HOOD-USD",
    SPCX: "SPCX-USD",
    AMD: "AMD-USD",
    INTC: "INTC-USD",
    MU: "MU-USD",
    SNDK: "SNDK-USD",
    BABA: "BABA-USD",
    CRCL: "CRCL-USD",
    MRVL: "MRVL-USD",
    MSTR: "MSTR-USD",
    PLTR: "PLTR-USD",
    CRWV: "CRWV-USD",
    SKHY: "SKHY-USD",
    BE: "BE-USD",
    NBIS: "NBIS-USD",
    MRNA: "MRNA-USD",
    RKLB: "RKLB-USD",
    BOT: "BOT-USD",
  };

  public metaCache: Record<string, ArcusMarketMeta> = {};
  private metaTs = 0;

  resolveSymbol(assetOrSymbol: string): string | null {
    const up = assetOrSymbol.toUpperCase();
    if (up in ArcusAPI.SYMBOLS) return ArcusAPI.SYMBOLS[up];
    if (Object.values(ArcusAPI.SYMBOLS).includes(up)) return up;
    if (up.endsWith("-USD")) return up;
    return null;
  }

  async loadMeta(): Promise<void> {
    if (
      Object.keys(this.metaCache).length > 0 &&
      Date.now() - this.metaTs < MARKETS_TTL_MS
    ) {
      return;
    }
    try {
      const resp = await fetch(`${BASE_URL}/markets`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "splitting-comparator/1.0",
        },
        cache: "no-store",
      });
      if (!resp.ok) return;
      const json = await resp.json();
      const markets: any[] = json?.markets || [];
      if (!Array.isArray(markets) || markets.length === 0) return;

      const cache: Record<string, ArcusMarketMeta> = {};
      for (const m of markets) {
        const symbol = String(m?.marketDisplayName || "").toUpperCase();
        if (!symbol) continue;
        const base = String(
          m?.baseAsset || symbol.split("-")[0]
        ).toUpperCase();

        const tiers: any[] = Array.isArray(m?.feeTiers) ? m.feeTiers : [];
        const tier0 =
          tiers.find((t) => Number(t?.level) === 0) ?? tiers[0] ?? null;

        const takerBps =
          ppmToBps(m?.effectiveTakerFeePpm) ??
          ppmToBps(tier0?.takerFeePpm) ??
          ppmToBps(m?.baseTakerFeePpm);
        const makerBps =
          ppmToBps(m?.effectiveMakerFeePpm) ??
          ppmToBps(tier0?.makerFeePpm) ??
          ppmToBps(m?.baseMakerFeePpm);

        const imf = Number(m?.initialMarginFraction);
        const maxLev =
          Number.isFinite(imf) && imf > 0 ? floorLeverage(1 / imf) : null;

        const entry: ArcusMarketMeta = {
          market_id: Number(m?.marketId ?? 0),
          symbol,
          base,
          taker_fee_bps: takerBps,
          maker_fee_bps: makerBps,
          max_leverage: maxLev,
          active: String(m?.status || "").toUpperCase() === "ONLINE",
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
  ): Promise<ArcusMarketMeta | null> {
    await this.loadMeta();
    const resolved = this.resolveSymbol(assetOrSymbol) || assetOrSymbol.toUpperCase();
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
    nLevels: number = ORDERBOOK_LEVELS
  ): Promise<Record<string, any> | null> {
    const symbol =
      this.resolveSymbol(assetOrSymbol) || assetOrSymbol.toUpperCase();
    try {
      const resp = await fetch(
        `${BASE_URL}/l2OrderBook/${encodeURIComponent(
          symbol
        )}?nLevels=${nLevels}`,
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

    const rawTs = Number(orderbook.timestamp);
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
      this.getOrderbook(symbol, ORDERBOOK_LEVELS),
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
