import crypto from "crypto";
import {
  ExecutionCalculator,
  floorLeverage,
  StandardizedOrderbook,
} from "../models";

const BASE_URL = "https://fapi.asterdex.com/fapi/v1";
const LEVERAGE_API =
  "https://www.asterdex.com/bapi/futures/v1/public/future/common/symbol/leverageoi/remaining";
const FEE_FAIL_TTL_MS = 60_000;

export class AsterAPI {
  private leverageCache: Record<string, number | null> = {};
  private leverageCacheLoaded: Record<string, boolean> = {};
  private feeCache: Record<string, { taker_fee_bps: number; maker_fee_bps: number }> = {};
  private feeFailTs: Record<string, number> = {};

  private get apiKey(): string {
    return process.env.ASTER_API_KEY || "";
  }

  private get secretKey(): string {
    return process.env.ASTER_SECRET_KEY || "";
  }

  private sign(queryString: string): string {
    return crypto
      .createHmac("sha256", this.secretKey)
      .update(queryString)
      .digest("hex");
  }

  private async signedGet(
    endpoint: string,
    params: Record<string, string | number>
  ): Promise<any> {
    const fullParams = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      fullParams.set(k, String(v));
    }
    fullParams.set("timestamp", String(Date.now()));
    fullParams.set("recvWindow", "10000");
    const sig = this.sign(fullParams.toString());
    fullParams.set("signature", sig);

    const url = `${BASE_URL}${endpoint}?${fullParams.toString()}`;
    try {
      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          "X-MBX-APIKEY": this.apiKey,
        },
        cache: "no-store",
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  async getFees(symbol: string): Promise<[number | null, number | null]> {
    if (this.feeCache[symbol]) {
      const c = this.feeCache[symbol];
      return [c.taker_fee_bps, c.maker_fee_bps];
    }

    const failTs = this.feeFailTs[symbol];
    if (failTs && Date.now() - failTs < FEE_FAIL_TTL_MS) {
      return [null, null];
    }

    if (!this.apiKey || !this.secretKey) {
      return [null, null];
    }

    try {
      const response = await this.signedGet("/commissionRate", { symbol });
      if (!response) {
        this.feeFailTs[symbol] = Date.now();
        return [null, null];
      }

      const makerRate = Number(response.makerCommissionRate || 0);
      const takerRate = Number(response.takerCommissionRate || 0);
      const takerBps = takerRate * 10000;
      const makerBps = makerRate * 10000;

      this.feeCache[symbol] = {
        taker_fee_bps: takerBps,
        maker_fee_bps: makerBps,
      };
      return [takerBps, makerBps];
    } catch {
      return [null, null];
    }
  }

  async getMaxLeverage(symbol: string): Promise<number | null> {
    if (this.leverageCacheLoaded[symbol]) {
      return floorLeverage(this.leverageCache[symbol]);
    }
    try {
      const res = await fetch(`${LEVERAGE_API}?symbol=${encodeURIComponent(symbol)}`, {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const leverageMap = data?.data?.leverageOiRemainingMap;
        if (data?.success && leverageMap && typeof leverageMap === "object") {
          const keys = Object.keys(leverageMap)
            .map((k) => parseInt(k, 10))
            .filter((n) => Number.isFinite(n));
          if (keys.length > 0) {
            const maxLev = Math.max(...keys);
            this.leverageCache[symbol] = maxLev;
            this.leverageCacheLoaded[symbol] = true;
            return floorLeverage(maxLev);
          }
        }
      }
    } catch {
      // ignore
    }
    this.leverageCacheLoaded[symbol] = true;
    this.leverageCache[symbol] = null;
    return null;
  }

  async getOrderbook(symbol: string): Promise<Record<string, any> | null> {
    try {
      const res = await fetch(
        `${BASE_URL}/depth?symbol=${encodeURIComponent(symbol)}&limit=1000`,
        {
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.bids?.length || !data?.asks?.length) return null;
      return {
        bids: data.bids.map((l: any) => ({
          price: Number(l[0]),
          qty: Number(l[1]),
        })),
        asks: data.asks.map((l: any) => ({
          price: Number(l[0]),
          qty: Number(l[1]),
        })),
      };
    } catch {
      return null;
    }
  }

  normalizeOrderbook(orderbook: Record<string, any> | null): StandardizedOrderbook | null {
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
