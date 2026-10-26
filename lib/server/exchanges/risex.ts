import {
  ExecutionCalculator,
  floorLeverage,
  OrderbookLevel,
  StandardizedOrderbook,
} from "../models";

const BASE_URL = "https://api.rise.trade/v1";
const RPC_URL = "https://rpc.risechain.com";
const PERPS_MANAGER = "0x53F10fAcfC8965750494e6965f5D6dA39b41D852";
const PERPS_MANAGER_ARG =
  "00000000000000000000000053f10facfc8965750494e6965f5d6da39b41d852";
const SEL_GET_FEE_MANAGER = "0xf2d63826";
const SEL_DEFAULT_MAKER_FEE = "0x7e99a359";
const SEL_DEFAULT_TAKER_FEE = "0x904e578f";
const MARKETS_TTL_MS = 300_000;
const ORDERBOOK_LIMIT = 250;

interface RISExMarketMeta {
  market_id: number;
  symbol: string;
  max_leverage: number | null;
  active: boolean;
}

export class RISExAPI {
  public marketCache: Record<number, RISExMarketMeta> = {};
  private marketCacheTs = 0;
  private defaultFees: [number | null, number | null] = [null, null];
  private feesTs = 0;

  private async ethCall(to: string, data: string): Promise<string | null> {
    try {
      const resp = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [{ to, data }, "latest"],
        }),
        cache: "no-store",
      });
      if (!resp.ok) return null;
      const json = await resp.json();
      const res = json?.result;
      return typeof res === "string" && res.startsWith("0x") && res.length > 2
        ? res
        : null;
    } catch {
      return null;
    }
  }

  private async loadFees(): Promise<void> {
    if (
      this.defaultFees[0] !== null &&
      Date.now() - this.feesTs < MARKETS_TTL_MS
    ) {
      return;
    }
    try {
      const fmRaw = await this.ethCall(PERPS_MANAGER, SEL_GET_FEE_MANAGER);
      if (!fmRaw || fmRaw.length < 42) return;
      const feeManager = "0x" + fmRaw.slice(-40);

      const [takerHex, makerHex] = await Promise.all([
        this.ethCall(feeManager, SEL_DEFAULT_TAKER_FEE + PERPS_MANAGER_ARG),
        this.ethCall(feeManager, SEL_DEFAULT_MAKER_FEE + PERPS_MANAGER_ARG),
      ]);
      if (!takerHex || !makerHex) return;

      const takerCentiBps = parseInt(takerHex, 16);
      const makerCentiBps = parseInt(makerHex, 16);
      if (Number.isFinite(takerCentiBps) && Number.isFinite(makerCentiBps)) {
        this.defaultFees = [takerCentiBps / 100, makerCentiBps / 100];
        this.feesTs = Date.now();
      }
    } catch {
      // ignore
    }
  }

  async loadMarketCache(): Promise<void> {
    if (
      Object.keys(this.marketCache).length > 0 &&
      Date.now() - this.marketCacheTs < MARKETS_TTL_MS
    ) {
      return;
    }
    try {
      const resp = await fetch(`${BASE_URL}/markets`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!resp.ok) return;
      const payload = await resp.json();
      const markets = payload?.data?.markets || payload?.markets || [];
      const cache: Record<number, RISExMarketMeta> = {};
      for (const m of markets) {
        const id = Number(m?.market_id);
        if (!Number.isFinite(id) || id <= 0) continue;
        const symbol =
          m.display_name || m.config?.name || m.base_asset_symbol || String(id);
        const maxLev = floorLeverage(
          m.config?.max_leverage ?? m.max_leverage ?? null
        );
        const active =
          Boolean(m.active ?? true) &&
          !Boolean(m.post_only) &&
          !Boolean(m.reduce_only);
        cache[id] = {
          market_id: id,
          symbol,
          max_leverage: maxLev,
          active,
        };
      }
      if (Object.keys(cache).length > 0) {
        this.marketCache = cache;
        this.marketCacheTs = Date.now();
      }
    } catch {
      // ignore
    }
  }

  async getFees(_marketId?: number): Promise<[number | null, number | null]> {
    await this.loadFees();
    return this.defaultFees;
  }

  async getMaxLeverage(marketId: number): Promise<number | null> {
    await this.loadMarketCache();
    return floorLeverage(this.marketCache[Number(marketId)]?.max_leverage);
  }

  async getOrderbook(
    marketId: number,
    limit: number = ORDERBOOK_LIMIT
  ): Promise<Record<string, any> | null> {
    try {
      const resp = await fetch(
        `${BASE_URL}/orderbook?market_id=${encodeURIComponent(
          String(marketId)
        )}&limit=${limit}`,
        {
          headers: { Accept: "application/json" },
          cache: "no-store",
        }
      );
      if (!resp.ok) return null;
      const payload = await resp.json();
      return payload?.data || null;
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
          price: Number(e?.price ?? 0),
          qty: Number(e?.quantity ?? 0),
        }))
        .filter((e) => Number.isFinite(e.price) && e.price > 0 && Number.isFinite(e.qty) && e.qty > 0);

    const bids = parse(rawBids);
    const asks = parse(rawAsks);
    if (!bids.length || !asks.length) return null;

    const bestBid = bids[0].price;
    const bestAsk = asks[0].price;
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

  async getOptimalExecution(
    marketId: number,
    orderSizeUsd: number
  ): Promise<Record<string, any> | null> {
    const [, [takerFeeBps, makerFeeBps], raw] = await Promise.all([
      this.loadMarketCache(),
      this.getFees(marketId),
      this.getOrderbook(marketId, ORDERBOOK_LIMIT),
    ]);
    if (takerFeeBps === null || !raw) return null;

    const meta = this.marketCache[Number(marketId)];
    if (meta && !meta.active) return null;

    const std = this.normalizeOrderbook(raw);
    if (!std) return null;

    const result = ExecutionCalculator.calculateExecutionCost(
      std,
      orderSizeUsd,
      takerFeeBps,
      takerFeeBps
    );
    if (!result) return null;

    result.symbol = meta?.symbol || String(marketId);
    result.max_leverage = meta?.max_leverage ?? null;
    result.fee_bps = takerFeeBps;
    result.maker_fee_bps = makerFeeBps;
    result.true_mid = result.mid_price;
    return result;
  }
}
