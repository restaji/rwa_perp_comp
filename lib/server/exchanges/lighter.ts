import {
  ExecutionCalculator,
  floorLeverage,
  StandardizedOrderbook,
} from "../models";

const BASE_URL = "https://mainnet.zklighter.elliot.ai/api/v1";

function feeToBps(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n * 100 : null;
}

interface LighterMarketMeta {
  taker_fee_bps: number | null;
  maker_fee_bps: number | null;
  min_initial_margin_fraction: number | null;
  symbol: string | null;
  status: string | null;
}

export class LighterAPI {
  public marketCache: Record<number, LighterMarketMeta> = {};
  private marketCacheLoadedAt = 0;
  private readonly cacheTtlMs = 300_000;

  async loadMarketCache(): Promise<void> {
    if (
      Object.keys(this.marketCache).length > 0 &&
      Date.now() - this.marketCacheLoadedAt < this.cacheTtlMs
    ) {
      return;
    }
    try {
      const res = await fetch(`${BASE_URL}/orderBookDetails`, {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();
      for (const market of json?.order_book_details || []) {
        if (market?.market_id == null) continue;
        const key = Number(market.market_id);
        const minMargin = market.min_initial_margin_fraction;
        this.marketCache[key] = {
          taker_fee_bps: feeToBps(market.taker_fee),
          maker_fee_bps: feeToBps(market.maker_fee),
          min_initial_margin_fraction: minMargin ? Number(minMargin) : null,
          symbol: market.symbol || market.market_symbol || market.name || null,
          status: market.status || null,
        };
      }
      this.marketCacheLoadedAt = Date.now();
    } catch {
      // ignore
    }
  }

  async getFees(marketId: number): Promise<[number | null, number | null]> {
    await this.loadMarketCache();
    const meta = this.marketCache[Number(marketId)];
    if (!meta || meta.taker_fee_bps == null) return [null, null];
    return [meta.taker_fee_bps, meta.maker_fee_bps];
  }

  async getMaxLeverage(marketId: number): Promise<number | null> {
    await this.loadMarketCache();
    const meta = this.marketCache[Number(marketId)];
    const minMargin = meta?.min_initial_margin_fraction;
    if (minMargin && minMargin > 0) {
      return floorLeverage(10000 / minMargin);
    }
    return null;
  }

  async getOrderbook(marketId: number): Promise<Record<string, any> | null> {
    try {
      const res = await fetch(
        `${BASE_URL}/orderBookOrders?market_id=${marketId}&limit=250`,
        {
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }
      );
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  normalizeOrderbook(orderbook: Record<string, any> | null): StandardizedOrderbook | null {
    if (!orderbook) return null;
    const bids = orderbook.bids || [];
    const asks = orderbook.asks || [];
    if (!bids.length || !asks.length) return null;

    const bestBid = Number(bids[0]?.price || 0);
    const bestAsk = Number(asks[0]?.price || 0);
    if (bestBid <= 0 || bestAsk <= 0) return null;

    return {
      bids: bids.map((b: any) => ({
        price: Number(b.price || 0),
        qty: Number(b.remaining_base_amount || 0),
      })),
      asks: asks.map((a: any) => ({
        price: Number(a.price || 0),
        qty: Number(a.remaining_base_amount || 0),
      })),
      best_bid: bestBid,
      best_ask: bestAsk,
      mid_price: (bestBid + bestAsk) / 2,
      timestamp: Date.now() / 1000,
    };
  }

  async calculateExecutionCost(
    orderbook: Record<string, any> | null,
    orderSizeUsd: number,
    marketId: number
  ): Promise<Record<string, any> | null> {
    const stdOrderbook = this.normalizeOrderbook(orderbook);
    if (!stdOrderbook || !marketId) return null;

    const [takerFeeBps, makerFeeBps] = await this.getFees(marketId);
    if (takerFeeBps === null) return null;

    const result = ExecutionCalculator.calculateExecutionCost(
      stdOrderbook,
      orderSizeUsd,
      takerFeeBps,
      takerFeeBps
    );
    if (result) {
      result.fee_bps = takerFeeBps;
      result.maker_fee_bps = makerFeeBps;
      result.max_leverage = await this.getMaxLeverage(marketId);
    }
    return result;
  }
}
