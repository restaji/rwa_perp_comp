import {
  ExecutionCalculator,
  floorLeverage,
  OrderbookLevel,
  StandardizedOrderbook,
} from "../models";

const INFO_URL = "https://rpc.txflow.com/info";
const API_VERSION = "2026-08-16";
const CACHE_TTL_MS = 300_000;

interface TxFlowMarketMeta {
  coin: string;
  name: string;
  base: string;
  max_leverage: number | null;
  active: boolean;
}

export class TxFlowAPI {
  private metaCache: Record<string, TxFlowMarketMeta> = {};
  private metaTs = 0;
  private fees: [number | null, number | null] = [null, null];
  private feesTs = 0;

  private async postInfo(body: Record<string, any>): Promise<any> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resp = await fetch(INFO_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "x-api-version": API_VERSION,
          },
          body: JSON.stringify(body),
          cache: "no-store",
        });
        if (!resp.ok) continue;
        const json = await resp.json();
        if (json?.success && json.code === 0) {
          return json.data;
        }
        return null;
      } catch {
        if (attempt === 1) return null;
      }
    }
    return null;
  }

  private async loadMeta(): Promise<void> {
    if (
      Object.keys(this.metaCache).length > 0 &&
      Date.now() - this.metaTs < CACHE_TTL_MS
    ) {
      return;
    }
    const data = await this.postInfo({
      type: "perpMeta",
      includeDelisted: false,
    });
    const universe = data?.universe;
    if (!Array.isArray(universe) || universe.length === 0) return;

    const cache: Record<string, TxFlowMarketMeta> = {};
    for (const u of universe) {
      if (u?.index == null || !u?.name) continue;
      const coin = String(u.index);
      const name = String(u.name).toUpperCase();
      const base = String(u.baseCurrency || name.split("-")[0]).toUpperCase();
      const entry: TxFlowMarketMeta = {
        coin,
        name,
        base,
        max_leverage: floorLeverage(u.maxLeverage),
        active: !Boolean(u.delisted) && !Boolean(u.haltTrading),
      };
      cache[name] = entry;
      cache[base] = entry;
      cache[coin] = entry;
    }
    if (Object.keys(cache).length > 0) {
      this.metaCache = cache;
      this.metaTs = Date.now();
    }
  }

  private async loadFees(): Promise<void> {
    if (this.fees[0] !== null && Date.now() - this.feesTs < CACHE_TTL_MS) {
      return;
    }
    const data = await this.postInfo({ type: "feeTierInfo" });
    const tiers: any[] = data?.tiers || [];
    let base = tiers.find((t) => Number(t?.level) === 0);
    if (!base && tiers.length > 0) {
      base = tiers.reduce((min, t) =>
        Number(t?.level ?? 99) < Number(min?.level ?? 99) ? t : min
      );
    }
    if (base && base.perpTakerFeeRate != null && base.perpMakerFeeRate != null) {
      const takerBps = Number(
        (Number(base.perpTakerFeeRate) * 10_000).toFixed(4)
      );
      const makerBps = Number(
        (Number(base.perpMakerFeeRate) * 10_000).toFixed(4)
      );
      if (Number.isFinite(takerBps) && Number.isFinite(makerBps)) {
        this.fees = [takerBps, makerBps];
        this.feesTs = Date.now();
        return;
      }
    }
  }

  async getFees(): Promise<[number | null, number | null]> {
    await this.loadFees();
    return this.fees;
  }

  private async resolveMarket(
    symbol: string
  ): Promise<TxFlowMarketMeta | null> {
    await this.loadMeta();
    const key = symbol.toUpperCase();
    return this.metaCache[key] || null;
  }

  async getMaxLeverage(symbol: string): Promise<number | null> {
    const meta = await this.resolveMarket(symbol);
    return floorLeverage(meta?.max_leverage);
  }

  async getOrderbook(symbol: string): Promise<Record<string, any> | null> {
    const meta = await this.resolveMarket(symbol);
    if (!meta || !meta.active) return null;
    return this.postInfo({
      type: "l2Book",
      coin: meta.coin,
    });
  }

  normalizeOrderbook(
    orderbook: Record<string, any> | null
  ): StandardizedOrderbook | null {
    if (!orderbook) return null;
    const levels = orderbook.levels || [];
    const rawBids = levels[0] || [];
    const rawAsks = levels[1] || [];
    if (!rawBids.length || !rawAsks.length) return null;

    const parse = (entries: any[]): OrderbookLevel[] =>
      entries
        .map((e) => ({
          price: Number(e?.px ?? 0),
          qty: Number(e?.sz ?? 0),
        }))
        .filter(
          (e) =>
            Number.isFinite(e.price) &&
            e.price > 0 &&
            Number.isFinite(e.qty) &&
            e.qty > 0
        );

    const bids = parse(rawBids);
    const asks = parse(rawAsks);
    if (!bids.length || !asks.length) return null;

    const bestBid = bids[0].price;
    const bestAsk = asks[0].price;
    if (bestBid <= 0 || bestAsk <= 0) return null;

    const tsMs = Number(orderbook.time);
    const timestamp =
      Number.isFinite(tsMs) && tsMs > 0 ? tsMs / 1000 : Date.now() / 1000;

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
    const [meta, [takerFeeBps, makerFeeBps]] = await Promise.all([
      this.resolveMarket(symbol),
      this.getFees(),
    ]);
    if (!meta || !meta.active || takerFeeBps === null) return null;

    const raw = await this.postInfo({
      type: "l2Book",
      coin: meta.coin,
    });
    if (!raw) return null;

    const std = this.normalizeOrderbook(raw);
    if (!std) return null;

    const result = ExecutionCalculator.calculateExecutionCost(
      std,
      orderSizeUsd,
      takerFeeBps,
      takerFeeBps
    );
    if (!result) return null;

    result.symbol = meta.name;
    result.max_leverage = meta.max_leverage;
    result.fee_bps = takerFeeBps;
    result.maker_fee_bps = makerFeeBps;
    result.true_mid = result.mid_price;
    return result;
  }
}
