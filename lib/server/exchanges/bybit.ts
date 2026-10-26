import { dohFetchJson, dohFetchText } from "../dohFetch";
import {
  ExecutionCalculator,
  floorLeverage,
  OrderbookLevel,
  StandardizedOrderbook,
} from "../models";

const BASE_URL = "https://api.bybit.com/v5/market";
const TRADFI_FEE_URL =
  "https://announcements.bybit.com/en/article/tradfi-perpetuals-lower-fees-across-all-tiers-bltb196506dada4be39/";
const CACHE_TTL_MS = 300_000;
const DEPTH_LIMIT = 200;

export class BybitAPI {
  static readonly SYMBOLS: Record<string, string> = {
    XAU: "XAUUSDT",
    XAG: "XAGUSDT",
    WTI: "CLUSDT",
    BRENT: "BZUSDT",
    EURUSD: "EURUSDUSDT",
    GBPUSD: "GBPUSDUSDT",
    USDJPY: "USDJPYUSDT",
    AAPL: "AAPLUSDT",
    MSFT: "MSFTUSDT",
    GOOG: "GOOGLUSDT",
    AMZN: "AMZNUSDT",
    META: "METAUSDT",
    NVDA: "NVDAUSDT",
    TSLA: "TSLAUSDT",
    US500: "SPYUSDT",
    US100: "QQQUSDT",
    COIN: "COINUSDT",
    HOOD: "HOODUSDT",
    SPCX: "SPCXUSDT",
    AMD: "AMDSTOCKUSDT",
    INTC: "INTCUSDT",
    MU: "MUUSDT",
    SNDK: "SNDKUSDT",
    CBRS: "CBRSUSDT",
    EWY: "EWYUSDT",
    BABA: "BABAUSDT",
    CRCL: "CRCLUSDT",
    MRVL: "MRVLUSDT",
    MSTR: "MSTRUSDT",
    BB: "BBXUSDT",
    PLTR: "PLTRUSDT",
    AVGO: "AVGOUSDT",
    NFLX: "NFLXUSDT",
    CRWV: "CRWVUSDT",
    SKHY: "SKHYUSDT",
    LLY: "LLYUSDT",
    BE: "BEUSDT",
    LITE: "LITEUSDT",
    DELL: "DELLUSDT",
    NBIS: "NBISUSDT",
    IREN: "IRENUSDT",
    ARM: "ARMUSDT",
    MRNA: "MRNAUSDT",
    RKLB: "RKLBUSDT",
    WDC: "WDCUSDT",
    NOW: "NOWUSDT",
    AMGN: "AMGNUSDT",
    CSCO: "CSCOUSDT",
    KLAC: "KLACUSDT",
    LRCX: "LRCXUSDT",
    TXN: "TXNUSDT",
    PANW: "PANWUSDT",
    APP: "APPSTOCKUSDT",
    ALAB: "ALABUSDT",
    DDOG: "DDOGUSDT",
    SNPS: "SNPSUSDT",
    ADBE: "ADBEUSDT",
    INTU: "INTUUSDT",
    ADI: "ADIUSDT",
    TER: "TERUSDT",
    SHOP: "SHOPUSDT",
    MELI: "MELIUSDT",
    ISRG: "ISRGUSDT",
    PDD: "PDDUSDT",
    PYPL: "PYPLUSDT",
    TTWO: "TTWOUSDT",
    WMT: "WMTUSDT",
    GILD: "GILDUSDT",
    VRTX: "VRTXSTOCKUSDT",
    REGN: "REGNUSDT",
    STX: "STXXUSDT",
    VST: "VSTUSDT",
    ANET: "ANETUSDT",
    UBER: "UBERUSDT",
    BA: "BAUSDT",
    SOFI: "SOFIUSDT",
    ASTS: "ASTSUSDT",
    BOT: "BOTUSDT",
  };

  private leverageCache: Record<string, number | null> = {};
  private metaLoadedAt = 0;
  private feesCache: [number | null, number | null] = [null, null];
  private feesLoadedAt = 0;

  resolveSymbol(assetOrSymbol: string): string | null {
    const up = assetOrSymbol.toUpperCase();
    if (up in BybitAPI.SYMBOLS) return BybitAPI.SYMBOLS[up];
    if (Object.values(BybitAPI.SYMBOLS).includes(up)) return up;
    return null;
  }

  private async loadFees(): Promise<void> {
    if (
      this.feesCache[0] !== null &&
      Date.now() - this.feesLoadedAt < CACHE_TTL_MS
    ) {
      return;
    }
    try {
      const html = await dohFetchText(TRADFI_FEE_URL);
      if (!html) return;
      const m = html.match(/VIP\s*0[\s\S]*?VIP\s*1/);
      if (!m) return;
      const rates = Array.from(m[0].matchAll(/(\d+(?:\.\d+)?)%/g)).map((x) =>
        Number(x[1])
      );
      if (rates.length >= 4 && Number.isFinite(rates[2]) && Number.isFinite(rates[3])) {
        const takerBps = Number((rates[2] * 100).toFixed(4));
        const makerBps = Number((rates[3] * 100).toFixed(4));
        this.feesCache = [takerBps, makerBps];
        this.feesLoadedAt = Date.now();
      }
    } catch {
      // ignore
    }
  }

  private async loadMeta(): Promise<void> {
    if (
      Object.keys(this.leverageCache).length > 0 &&
      Date.now() - this.metaLoadedAt < CACHE_TTL_MS
    ) {
      return;
    }
    try {
      const cache: Record<string, number | null> = {};
      let cursor = "";
      for (let page = 0; page < 3; page++) {
        const url = `${BASE_URL}/instruments-info?category=linear&limit=1000${
          cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""
        }`;
        const data = await dohFetchJson(url);
        const list = data?.result?.list || [];
        for (const item of list) {
          if (!item?.symbol || item?.status !== "Trading") continue;
          cache[String(item.symbol).toUpperCase()] = floorLeverage(
            item?.leverageFilter?.maxLeverage
          );
        }
        cursor = data?.result?.nextPageCursor || "";
        if (!cursor) break;
      }
      if (Object.keys(cache).length > 0) {
        this.leverageCache = cache;
        this.metaLoadedAt = Date.now();
      }
    } catch {
      // ignore
    }
  }

  async getFees(_symbol?: string): Promise<[number | null, number | null]> {
    await this.loadFees();
    return this.feesCache;
  }

  async getMaxLeverage(symbol: string): Promise<number | null> {
    await this.loadMeta();
    const resolved = this.resolveSymbol(symbol) || symbol.toUpperCase();
    return floorLeverage(this.leverageCache[resolved]);
  }

  async getOrderbook(
    symbol: string,
    limit: number = DEPTH_LIMIT
  ): Promise<Record<string, any> | null> {
    const resolved = this.resolveSymbol(symbol) || symbol.toUpperCase();
    const data = await dohFetchJson(
      `${BASE_URL}/orderbook?category=linear&symbol=${encodeURIComponent(
        resolved
      )}&limit=${limit}`
    );
    return data?.result || null;
  }

  normalizeOrderbook(
    orderbook: Record<string, any> | null
  ): StandardizedOrderbook | null {
    if (!orderbook) return null;
    const rawBids = orderbook.b || [];
    const rawAsks = orderbook.a || [];
    if (!rawBids.length || !rawAsks.length) return null;

    const parse = (entries: any[]): OrderbookLevel[] =>
      entries
        .map((e) => ({
          price: Number(Array.isArray(e) ? e[0] : e?.price ?? 0),
          qty: Number(Array.isArray(e) ? e[1] : e?.qty ?? 0),
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

    const tsMs = Number(orderbook.ts);
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
    assetOrSymbol: string,
    orderSizeUsd: number
  ): Promise<Record<string, any> | null> {
    const symbol = this.resolveSymbol(assetOrSymbol);
    if (!symbol) return null;

    const [[takerFeeBps, makerFeeBps], raw, maxLev] = await Promise.all([
      this.getFees(symbol),
      this.getOrderbook(symbol, DEPTH_LIMIT),
      this.getMaxLeverage(symbol),
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

    result.symbol = symbol;
    result.max_leverage = maxLev;
    result.fee_bps = takerFeeBps;
    result.maker_fee_bps = makerFeeBps;
    result.true_mid = result.mid_price;
    return result;
  }
}
