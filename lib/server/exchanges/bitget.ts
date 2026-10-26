import { dohFetchJson } from "../dohFetch";
import {
  ExecutionCalculator,
  floorLeverage,
  OrderbookLevel,
  StandardizedOrderbook,
} from "../models";

const BASE_URL = "https://api.bitget.com/api/v2/mix/market";
const PRODUCT_TYPE = "USDT-FUTURES";
const CACHE_TTL_MS = 300_000;
const DEPTH_LIMIT = 100;

interface BitgetContractMeta {
  symbol: string;
  taker_fee_bps: number | null;
  maker_fee_bps: number | null;
  max_leverage: number | null;
}

export class BitgetAPI {
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
    BB: "BBSTOCKUSDT",
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
    AMGN: "AMGNUSDT",
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
    ADI: "ADIUSDT",
    TER: "TERUSDT",
    SHOP: "SHOPUSDT",
    BKNG: "BKNGUSDT",
    MELI: "MELIUSDT",
    ISRG: "ISRGUSDT",
    ABNB: "ABNBUSDT",
    PDD: "PDDUSDT",
    PYPL: "PYPLUSDT",
    TTWO: "TTWOUSDT",
    WMT: "WMTUSDT",
    GILD: "GILDUSDT",
    LIN: "LINUSDT",
    STX: "STXSTOCKUSDT",
    AXON: "AXONUSDT",
    VST: "VSTUSDT",
    ANET: "ANETUSDT",
    UBER: "UBERUSDT",
    BA: "BAUSDT",
    SOFI: "SOFIUSDT",
    ASTS: "ASTSUSDT",
    BOT: "BOTUSDT",
  };

  private metaCache: Record<string, BitgetContractMeta> = {};
  private metaLoadedAt = 0;

  resolveSymbol(assetOrSymbol: string): string | null {
    const up = assetOrSymbol.toUpperCase();
    if (up in BitgetAPI.SYMBOLS) return BitgetAPI.SYMBOLS[up];
    if (Object.values(BitgetAPI.SYMBOLS).includes(up)) return up;
    return null;
  }

  private async loadMeta(): Promise<void> {
    if (
      Object.keys(this.metaCache).length > 0 &&
      Date.now() - this.metaLoadedAt < CACHE_TTL_MS
    ) {
      return;
    }
    try {
      const data = await dohFetchJson(
        `${BASE_URL}/contracts?productType=${PRODUCT_TYPE}`
      );
      const list = data?.data || [];
      const cache: Record<string, BitgetContractMeta> = {};
      for (const c of list) {
        if (!c?.symbol || c?.symbolStatus !== "normal") continue;
        const sym = String(c.symbol).toUpperCase();
        const taker =
          c.takerFeeRate != null ? Number(c.takerFeeRate) * 10_000 : null;
        const maker =
          c.makerFeeRate != null ? Number(c.makerFeeRate) * 10_000 : null;
        cache[sym] = {
          symbol: sym,
          taker_fee_bps:
            taker !== null && Number.isFinite(taker) ? taker : null,
          maker_fee_bps:
            maker !== null && Number.isFinite(maker) ? maker : null,
          max_leverage: floorLeverage(c.maxLever),
        };
      }
      if (Object.keys(cache).length > 0) {
        this.metaCache = cache;
        this.metaLoadedAt = Date.now();
      }
    } catch {
      // ignore
    }
  }

  async getFees(symbol?: string): Promise<[number | null, number | null]> {
    await this.loadMeta();
    if (symbol) {
      const resolved = this.resolveSymbol(symbol) || symbol.toUpperCase();
      const meta = this.metaCache[resolved];
      if (meta) return [meta.taker_fee_bps, meta.maker_fee_bps];
    }
    return [null, null];
  }

  async getMaxLeverage(symbol: string): Promise<number | null> {
    await this.loadMeta();
    const resolved = this.resolveSymbol(symbol) || symbol.toUpperCase();
    return floorLeverage(this.metaCache[resolved]?.max_leverage);
  }

  async getOrderbook(
    symbol: string,
    limit: number = DEPTH_LIMIT
  ): Promise<Record<string, any> | null> {
    const resolved = this.resolveSymbol(symbol) || symbol.toUpperCase();
    const data = await dohFetchJson(
      `${BASE_URL}/merge-depth?productType=${PRODUCT_TYPE}&symbol=${encodeURIComponent(
        resolved
      )}&limit=${limit}`
    );
    return data?.data || null;
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
