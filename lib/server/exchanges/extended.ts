import {
  ExecutionCalculator,
  floorLeverage,
  StandardizedOrderbook,
} from "../models";

const BASE_URL = "https://api.starknet.extended.exchange/api/v1";

export class ExtendedAPI {
  private marketCache: Record<string, { max_leverage: number | null }> = {};
  private marketCacheLoaded: Record<string, boolean> = {};
  private feeCache: Record<
    string,
    { taker_fee_bps: number; maker_fee_bps: number }
  > = {};

  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-API-Key": process.env.EXTENDED_API_KEY || "",
    };
  }

  async getFees(market: string): Promise<[number | null, number | null]> {
    if (this.feeCache[market]) {
      const c = this.feeCache[market];
      return [c.taker_fee_bps, c.maker_fee_bps];
    }
    try {
      const res = await fetch(
        `${BASE_URL}/user/fees?market=${encodeURIComponent(market)}`,
        {
          headers: this.headers,
          cache: "no-store",
        }
      );
      if (!res.ok) return [null, null];
      const data = await res.json();
      const rawData = data?.data ?? data;
      const raw =
        Array.isArray(rawData) && rawData.length > 0
          ? rawData[0]
          : rawData && typeof rawData === "object"
          ? rawData
          : null;
      if (!raw) return [null, null];

      const taker = raw.takerFeeRate ?? raw.takerFee ?? raw.taker_fee;
      const maker = raw.makerFeeRate ?? raw.makerFee ?? raw.maker_fee;
      if (taker == null || maker == null) return [null, null];

      const takerBps = Number(taker) * 10000;
      const makerBps = Number(maker) * 10000;
      this.feeCache[market] = {
        taker_fee_bps: takerBps,
        maker_fee_bps: makerBps,
      };
      return [takerBps, makerBps];
    } catch {
      return [null, null];
    }
  }

  async getMaxLeverage(market: string): Promise<number | null> {
    if (this.marketCacheLoaded[market]) {
      return floorLeverage(this.marketCache[market]?.max_leverage);
    }
    try {
      const res = await fetch(
        `${BASE_URL}/info/markets?market=${encodeURIComponent(market)}`,
        {
          headers: this.headers,
          cache: "no-store",
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.status === "OK" && Array.isArray(data.data) && data.data[0]) {
          const tradingConfig = data.data[0].tradingConfig || {};
          this.marketCache[market] = {
            max_leverage: floorLeverage(tradingConfig.maxLeverage),
          };
          this.marketCacheLoaded[market] = true;
        }
      }
    } catch {
      // ignore
    }
    return floorLeverage(this.marketCache[market]?.max_leverage);
  }

  async getOrderbook(market: string): Promise<Record<string, any> | null> {
    try {
      const res = await fetch(
        `${BASE_URL}/info/markets/${encodeURIComponent(market)}/orderbook`,
        {
          headers: this.headers,
          cache: "no-store",
        }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data?.status === "OK" ? data.data : null;
    } catch {
      return null;
    }
  }

  normalizeOrderbook(
    orderbook: Record<string, any> | null
  ): StandardizedOrderbook | null {
    if (!orderbook) return null;
    const bids = orderbook.bid || [];
    const asks = orderbook.ask || [];
    if (!bids.length || !asks.length) return null;

    const bestBid = Number(bids[0]?.price || 0);
    const bestAsk = Number(asks[0]?.price || 0);
    if (bestBid <= 0 || bestAsk <= 0) return null;

    return {
      bids: bids.map((b: any) => ({
        price: Number(b.price),
        qty: Number(b.qty),
      })),
      asks: asks.map((a: any) => ({
        price: Number(a.price),
        qty: Number(a.qty),
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
    market: string
  ): Promise<Record<string, any> | null> {
    const stdOrderbook = this.normalizeOrderbook(orderbook);
    if (!stdOrderbook || !market) return null;

    const [[takerBps, makerBps], maxLeverage] = await Promise.all([
      this.getFees(market),
      this.getMaxLeverage(market),
    ]);
    if (takerBps === null || makerBps === null) return null;

    const result = ExecutionCalculator.calculateExecutionCost(
      stdOrderbook,
      orderSizeUsd,
      takerBps,
      takerBps
    );
    if (result) {
      result.fee_bps = takerBps;
      result.maker_fee_bps = makerBps;
      result.max_leverage = maxLeverage;
    }
    return result;
  }
}
