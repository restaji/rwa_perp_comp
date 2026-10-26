import {
  ExecutionCalculator,
  floorLeverage,
  OrderbookLevel,
  StandardizedOrderbook,
} from "../models";

const BASE_URL = "https://api.pacifica.fi/api/v1";
const INFO_TTL_MS = 300_000;
const FEES_TTL_MS = 300_000;
const AGG_LEVEL = 1;

const SYMBOL_ALIASES: Record<string, string> = {
  GOLD: "XAU",
  SILVER: "XAG",
  WTI: "CL",
  GOOG: "GOOGL",
  US500: "SP500",
  SPY: "SP500",
};

export class PacificaAPI {
  private metaCache: Record<string, { max_leverage: number | null }> = {};
  private metaTs = 0;
  private fees: [number | null, number | null] = [null, null];
  private feesTs = 0;

  resolveSymbol(symbol: string): string {
    const upper = symbol.toUpperCase();
    return SYMBOL_ALIASES[upper] || upper;
  }

  private async loadMeta(): Promise<void> {
    if (
      Object.keys(this.metaCache).length > 0 &&
      Date.now() - this.metaTs < INFO_TTL_MS
    ) {
      return;
    }
    try {
      const resp = await fetch(`${BASE_URL}/info`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "splitting-comparator/1.0",
        },
        cache: "no-store",
      });
      if (!resp.ok) return;
      const payload = await resp.json();
      if (!payload?.success) return;
      const cache: Record<string, { max_leverage: number | null }> = {};
      for (const m of payload.data || []) {
        if (!m?.symbol) continue;
        cache[String(m.symbol).toUpperCase()] = {
          max_leverage: floorLeverage(m.max_leverage),
        };
      }
      if (Object.keys(cache).length > 0) {
        this.metaCache = cache;
        this.metaTs = Date.now();
      }
    } catch {
      // ignore
    }
  }

  private async loadFees(): Promise<void> {
    if (this.fees[0] !== null && Date.now() - this.feesTs < FEES_TTL_MS) {
      return;
    }
    try {
      const resp = await fetch(`${BASE_URL}/info/fees`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "splitting-comparator/1.0",
        },
        cache: "no-store",
      });
      if (!resp.ok) return;
      const payload = await resp.json();
      if (!payload?.success) return;
      const tiers: any[] = payload.data || [];
      let base = tiers.find((t) => t.level === 0);
      if (!base && tiers.length > 0) {
        base = tiers.reduce((min, t) =>
          (t.level ?? 99) < (min.level ?? 99) ? t : min
        );
      }
      if (!base) return;
      const takerBps = Number((Number(base.taker_fee_rate) * 10_000).toFixed(4));
      const makerBps = Number((Number(base.maker_fee_rate) * 10_000).toFixed(4));
      this.fees = [takerBps, makerBps];
      this.feesTs = Date.now();
    } catch {
      // ignore
    }
  }

  async getFees(): Promise<[number | null, number | null]> {
    await this.loadFees();
    return this.fees;
  }

  async getMaxLeverage(symbol: string): Promise<number | null> {
    await this.loadMeta();
    return floorLeverage(
      this.metaCache[this.resolveSymbol(symbol)]?.max_leverage
    );
  }

  async getOrderbook(
    symbol: string,
    aggLevel: number = AGG_LEVEL
  ): Promise<Record<string, any> | null> {
    const apiSymbol = this.resolveSymbol(symbol);
    try {
      const resp = await fetch(
        `${BASE_URL}/book?symbol=${encodeURIComponent(
          apiSymbol
        )}&agg_level=${aggLevel}`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "splitting-comparator/1.0",
          },
          cache: "no-store",
        }
      );
      if (!resp.ok) return null;
      const payload = await resp.json();
      if (!payload?.success) return null;
      return payload.data || null;
    } catch {
      return null;
    }
  }

  normalizeOrderbook(
    orderbook: Record<string, any> | null
  ): StandardizedOrderbook | null {
    if (!orderbook) return null;
    const levels = orderbook.l || [];
    const rawBids = levels[0] || [];
    const rawAsks = levels[1] || [];
    if (!rawBids.length || !rawAsks.length) return null;

    const parse = (entries: any[]): OrderbookLevel[] =>
      entries
        .map((e) => ({ price: Number(e?.p || 0), qty: Number(e?.a || 0) }))
        .filter((e) => e.price > 0 && e.qty > 0);

    const bids = parse(rawBids);
    const asks = parse(rawAsks);
    if (!bids.length || !asks.length) return null;

    const bestBid = bids[0].price;
    const bestAsk = asks[0].price;
    if (bestBid <= 0 || bestAsk <= 0) return null;

    const tsMs = Number(orderbook.t);
    const timestamp = Number.isFinite(tsMs) && tsMs > 0 ? tsMs / 1000 : Date.now() / 1000;

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
    symbol: string,
    orderSizeUsd: number
  ): Promise<Record<string, any> | null> {
    const apiSymbol = this.resolveSymbol(symbol);
    const [[takerFeeBps, makerFeeBps], raw, maxLev] = await Promise.all([
      this.getFees(),
      this.getOrderbook(apiSymbol, AGG_LEVEL),
      this.getMaxLeverage(apiSymbol),
    ]);
    if (takerFeeBps === null || !raw) return null;

    const std = this.normalizeOrderbook(raw);
    if (!std) return null;

    const result = ExecutionCalculator.calculateExecutionCost(
      std,
      orderSizeUsd,
      takerFeeBps,
      takerFeeBps
    );
    if (!result) return null;

    result.symbol = apiSymbol;
    result.max_leverage = maxLev;
    result.fee_bps = takerFeeBps;
    result.maker_fee_bps = makerFeeBps;
    result.agg_level = AGG_LEVEL;
    result.true_mid = result.mid_price;
    return result;
  }
}
