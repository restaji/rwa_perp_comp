import { dohFetchJson, dohFetchText } from "../dohFetch";
import {
  ExecutionCalculator,
  floorLeverage,
  OrderbookLevel,
  StandardizedOrderbook,
} from "../models";

const FAPI_BASE = "https://fapi.binance.com/fapi/v1";
const BRACKETS_URL =
  "https://www.binance.com/bapi/futures/v1/public/future/common/brackets";
const TRADFI_FEE_CMS_URL =
  "https://www.binance.com/bapi/composite/v1/public/cms/article/detail/query?articleCode=a4c3f1957f2b4e69902985154235c3b1";
const CACHE_TTL_MS = 300_000;
const DEPTH_LIMIT = 1000;

export class BinanceAPI {
  static readonly SYMBOLS: Record<string, string> = {
    XAU: "XAUUSDT",
    XAG: "XAGUSDT",
    WTI: "CLUSDT",
    BRENT: "BZUSDT",
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
    AMD: "AMDUSDT",
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
    STRC: "STRCUSDT",
    DELL: "DELLUSDT",
    NBIS: "NBISUSDT",
    IREN: "IRENUSDT",
    ARM: "ARMUSDT",
    MRNA: "MRNAUSDT",
    RKLB: "RKLBUSDT",
    WDC: "WDCUSDT",
    NOW: "NOWUSDT",
    CSCO: "CSCOUSDT",
    KLAC: "KLACUSDT",
    LRCX: "LRCXUSDT",
    TXN: "TXNUSDT",
    PANW: "PANWUSDT",
    APP: "APPUSDT",
    ALAB: "ALABUSDT",
    DDOG: "DDOGUSDT",
    CEG: "CEGUSDT",
    SNPS: "SNPSUSDT",
    ADBE: "ADBEUSDT",
    TER: "TERUSDT",
    SHOP: "SHOPUSDT",
    PDD: "PDDUSDT",
    PYPL: "PYPLUSDT",
    TTWO: "TTWOUSDT",
    WMT: "WMTUSDT",
    STX: "STXXUSDT",
    VST: "VSTUSDT",
    ANET: "ANETUSDT",
    UBER: "UBERUSDT",
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
    if (up in BinanceAPI.SYMBOLS) return BinanceAPI.SYMBOLS[up];
    if (Object.values(BinanceAPI.SYMBOLS).includes(up)) return up;
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
      const raw = await dohFetchText(TRADFI_FEE_CMS_URL);
      if (!raw) return;
      const m = raw.match(/Regular User[\s\S]*?(?:VIP\s*1|<\/tr>)/);
      if (!m) return;
      const rates = Array.from(m[0].matchAll(/(\d+(?:\.\d+)?)%/g)).map((x) =>
        Number(x[1])
      );
      if (rates.length >= 2 && Number.isFinite(rates[0]) && Number.isFinite(rates[1])) {
        const makerBps = Number((rates[0] * 100).toFixed(4));
        const takerBps = Number((rates[1] * 100).toFixed(4));
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
      const [bracketsData, exInfo] = await Promise.all([
        dohFetchJson(BRACKETS_URL, { method: "POST", body: {} }),
        dohFetchJson(`${FAPI_BASE}/exchangeInfo`),
      ]);

      const cache: Record<string, number | null> = {};

      for (const s of exInfo?.symbols || []) {
        if (!s?.symbol) continue;
        const reqMargin = Number(s.requiredMarginPercent);
        if (Number.isFinite(reqMargin) && reqMargin > 0) {
          cache[String(s.symbol).toUpperCase()] = floorLeverage(
            100 / reqMargin
          );
        }
      }

      for (const b of bracketsData?.data?.brackets || []) {
        if (!b?.symbol) continue;
        const maxLev = floorLeverage(
          b?.riskBrackets?.[0]?.maxOpenPosLeverage
        );
        if (maxLev !== null) {
          cache[String(b.symbol).toUpperCase()] = maxLev;
        }
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
    return dohFetchJson(
      `${FAPI_BASE}/depth?symbol=${encodeURIComponent(
        resolved
      )}&limit=${limit}`
    );
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

    const tsMs = Number(orderbook.T || orderbook.E);
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
