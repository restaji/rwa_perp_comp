import {
  ExecutionCalculator,
  floorLeverage,
  StandardizedOrderbook,
} from "../models";

const BASE_URL = "https://api.ondoperps.xyz/v1";
const MAX_ORDERBOOK = 100;
const MARKETS_TTL_MS = 300_000;

export class OndoAPI {
  private marketsCache: Record<
    string,
    {
      taker_fee_bps: number | null;
      maker_fee_bps: number | null;
      max_leverage: number | null;
    }
  > = {};
  private marketsTs = 0;

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {
      Accept: "application/json",
    };
    if (process.env.ONDO_API_KEY) {
      h["x-api-key"] = process.env.ONDO_API_KEY;
    }
    return h;
  }

  private maxLevFromBrackets(marginInfo: any[]): number | null {
    let maxLev: number | null = null;
    for (const bracket of marginInfo || []) {
      const lev = floorLeverage(bracket?.maxLeverage);
      if (lev === null) continue;
      if (maxLev === null || lev > maxLev) maxLev = lev;
    }
    return maxLev;
  }

  private async loadMarkets(): Promise<void> {
    if (
      Object.keys(this.marketsCache).length > 0 &&
      Date.now() - this.marketsTs < MARKETS_TTL_MS
    ) {
      return;
    }
    try {
      const resp = await fetch(`${BASE_URL}/markets`, {
        headers: this.headers,
        cache: "no-store",
      });
      if (!resp.ok) return;
      const json = await resp.json();
      const pairs = json?.result?.perps?.tradingPairs || [];
      const cache: Record<
        string,
        {
          taker_fee_bps: number | null;
          maker_fee_bps: number | null;
          max_leverage: number | null;
        }
      > = {};
      for (const m of pairs) {
        const market = m?.market;
        if (!market) continue;
        const takerBps =
          m.takerFee != null ? Number(m.takerFee) * 10000 : null;
        const makerBps =
          m.makerFee != null ? Number(m.makerFee) * 10000 : null;
        cache[market] = {
          taker_fee_bps: Number.isFinite(takerBps) ? takerBps : null,
          maker_fee_bps: Number.isFinite(makerBps) ? makerBps : null,
          max_leverage: this.maxLevFromBrackets(m.marginInfo || []),
        };
      }
      if (Object.keys(cache).length > 0) {
        this.marketsCache = cache;
        this.marketsTs = Date.now();
      }
    } catch {
      // ignore
    }
  }

  async getFees(market: string): Promise<[number | null, number | null]> {
    await this.loadMarkets();
    const meta = this.marketsCache[market];
    if (!meta) return [null, null];
    return [meta.taker_fee_bps, meta.maker_fee_bps];
  }

  async getMaxLeverage(market: string): Promise<number | null> {
    await this.loadMarkets();
    return floorLeverage(this.marketsCache[market]?.max_leverage);
  }

  async getOrderbook(market: string): Promise<Record<string, any> | null> {
    try {
      const resp = await fetch(
        `${BASE_URL}/perps/depth?market=${encodeURIComponent(
          market
        )}&maxOrderbook=${MAX_ORDERBOOK}`,
        {
          headers: this.headers,
          cache: "no-store",
        }
      );
      if (!resp.ok) return null;
      const json = await resp.json();
      const result = json?.result || {};
      const rawBids = result.bids || [];
      const rawAsks = result.asks || [];
      if (!rawBids.length || !rawAsks.length) return null;

      return {
        bids: rawBids.map((l: any) => ({
          price: Number(l[0]),
          qty: Number(l[1]),
        })),
        asks: rawAsks.map((l: any) => ({
          price: Number(l[0]),
          qty: Number(l[1]),
        })),
      };
    } catch {
      return null;
    }
  }

  normalizeOrderbook(
    orderbook: Record<string, any> | null
  ): StandardizedOrderbook | null {
    if (!orderbook) return null;
    const bids = orderbook.bids || [];
    const asks = orderbook.asks || [];
    if (!bids.length || !asks.length) return null;

    const bestBid = Number(bids[0].price);
    const bestAsk = Number(asks[0].price);
    if (bestBid <= 0 || bestAsk <= 0) return null;

    return {
      bids,
      asks,
      best_bid: bestBid,
      best_ask: bestAsk,
      mid_price: (bestBid + bestAsk) / 2,
      timestamp: Date.now() / 1000,
    };
  }

  async calculateExecutionCost(
    orderbook: Record<string, any> | null,
    orderSizeUsd: number,
    symbol: string
  ): Promise<Record<string, any> | null> {
    const stdOrderbook = this.normalizeOrderbook(orderbook);
    if (!stdOrderbook || !symbol) return null;

    const [[takerFeeBps, makerFeeBps], maxLeverage] = await Promise.all([
      this.getFees(symbol),
      this.getMaxLeverage(symbol),
    ]);
    if (takerFeeBps === null) return null;

    const result = ExecutionCalculator.calculateExecutionCost(
      stdOrderbook,
      orderSizeUsd,
      takerFeeBps,
      0
    );
    if (result) {
      result.fee_bps = takerFeeBps;
      result.maker_fee_bps = makerFeeBps;
      result.max_leverage = maxLeverage;
    }
    return result;
  }
}
