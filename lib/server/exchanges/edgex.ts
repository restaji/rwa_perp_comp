import {
  ExecutionCalculator,
  floorLeverage,
  StandardizedOrderbook,
} from "../models";

const BASE_URL = "https://edgex-prod-v2.edgex.exchange/api/v2/public";
const DEPTH_URL = `${BASE_URL}/quote/getDepth`;
const META_URL = `${BASE_URL}/meta/getMetaData`;

export class EdgeXAPI {
  public metaCache: Record<
    string,
    {
      taker_fee_bps: number;
      maker_fee_bps: number;
      max_leverage: number | null;
      contract_name: string;
    }
  > = {};
  private metaLoadedAt = 0;
  private readonly cacheTtlMs = 300_000;

  async loadMetaCache(): Promise<void> {
    if (
      Object.keys(this.metaCache).length > 0 &&
      Date.now() - this.metaLoadedAt < this.cacheTtlMs
    ) {
      return;
    }
    try {
      const res = await fetch(META_URL, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();
      const contracts = json?.data?.contractList || [];
      for (const c of contracts) {
        const cid = String(c?.contractId || "");
        if (!cid) continue;
        const takerFeeBps = Number(c.defaultTakerFeeRate || 0) * 10_000;
        const makerFeeBps = Number(c.defaultMakerFeeRate || 0) * 10_000;
        const riskTiers = c.riskTierList || [];
        const maxLev =
          Array.isArray(riskTiers) && riskTiers.length > 0
            ? floorLeverage(riskTiers[0]?.maxLeverage)
            : null;
        this.metaCache[cid] = {
          taker_fee_bps: takerFeeBps,
          maker_fee_bps: makerFeeBps,
          max_leverage: maxLev,
          contract_name: c.contractName || "",
        };
      }
      this.metaLoadedAt = Date.now();
    } catch {
      // ignore
    }
  }

  async getFees(contractId: number): Promise<[number | null, number | null]> {
    await this.loadMetaCache();
    const entry = this.metaCache[String(contractId)];
    if (!entry) return [null, null];
    return [entry.taker_fee_bps, entry.maker_fee_bps];
  }

  async getMaxLeverage(contractId: number): Promise<number | null> {
    await this.loadMetaCache();
    return floorLeverage(this.metaCache[String(contractId)]?.max_leverage);
  }

  async getOrderbook(contractId: number): Promise<StandardizedOrderbook | null> {
    try {
      const res = await fetch(
        `${DEPTH_URL}?contractId=${contractId}&level=200`,
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.code !== "SUCCESS") return null;
      const entries = data?.data || [];
      if (!entries.length) return null;
      const book = entries[0];
      const rawAsks = book?.asks || [];
      const rawBids = book?.bids || [];
      if (!rawAsks.length || !rawBids.length) return null;

      const bestAsk = Number(rawAsks[0]?.price || 0);
      const bestBid = Number(rawBids[0]?.price || 0);
      if (bestAsk <= 0 || bestBid <= 0) return null;
      const mid = (bestAsk + bestBid) / 2;

      return {
        bids: rawBids.map((b: any) => ({
          price: Number(b.price),
          qty: Number(b.size),
        })),
        asks: rawAsks.map((a: any) => ({
          price: Number(a.price),
          qty: Number(a.size),
        })),
        best_bid: bestBid,
        best_ask: bestAsk,
        mid_price: mid,
        timestamp: Date.now() / 1000,
      };
    } catch {
      return null;
    }
  }

  async calculateExecutionCost(
    contractId: number,
    orderSizeUsd: number,
    direction: string = "long",
    symbol: string | null = null
  ): Promise<Record<string, any> | null> {
    const [ob, [takerFeeBps, makerFeeBps], maxLev] = await Promise.all([
      this.getOrderbook(contractId),
      this.getFees(contractId),
      this.getMaxLeverage(contractId),
    ]);
    if (!ob || takerFeeBps === null) return null;

    const result = ExecutionCalculator.calculateExecutionCost(
      ob,
      orderSizeUsd,
      takerFeeBps,
      takerFeeBps
    );
    if (!result) return null;

    const buySlipBps = Number(result.buy_slippage_bps || 0);
    const sellSlipBps = Number(result.sell_slippage_bps || 0);
    const isLong = direction.toLowerCase() === "long";

    result.opening_slippage_bps = isLong ? buySlipBps : sellSlipBps;
    result.closing_slippage_bps = isLong ? sellSlipBps : buySlipBps;
    result.slippage_type = "opening_closing";
    result.total_cost_bps = buySlipBps + sellSlipBps + takerFeeBps * 2;
    result.symbol = symbol;
    result.max_leverage = maxLev;
    result.maker_fee_bps = makerFeeBps;
    return result;
  }
}
