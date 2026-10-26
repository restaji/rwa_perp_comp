/**
 * lib/server/models.ts
 * Ported 1:1 from venue_data/models.py
 */

export const HYPERLIQUID_GROWTH_MODE_SCALE = 0.1;
export const HYPERLIQUID_NO_GROWTH_MODE_SCALE = 1.0;

export function floorLeverage(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export interface AssetConfig {
  name: string;
  symbol_key: string;
  asset_class: "commodity" | "forex" | "index" | "stock";
  hyperliquid_symbol: string | null;
  lighter_market_id: number | null;
  aster_symbol: string | null;
  ostium_symbol: string | null;
  extended_symbol?: string | null;
  edgex_contract_id?: number | null;
  edgex_symbol?: string | null;
  grvt_instrument?: string | null;
  extended_display_symbol?: string | null;
  ondo_symbol?: string | null;
  pacifica_symbol?: string | null;
}

function cfg(
  name: string,
  symbol_key: string,
  asset_class: AssetConfig["asset_class"],
  hyperliquid_symbol: string | null,
  lighter_market_id: number | null,
  aster_symbol: string | null,
  ostium_symbol: string | null,
  extended_symbol: string | null = null,
  edgex_contract_id: number | null = null,
  edgex_symbol: string | null = null,
  grvt_instrument: string | null = null,
  opts: {
    extended_display_symbol?: string | null;
    ondo_symbol?: string | null;
    pacifica_symbol?: string | null;
  } = {}
): AssetConfig {
  return {
    name,
    symbol_key,
    asset_class,
    hyperliquid_symbol,
    lighter_market_id,
    aster_symbol,
    ostium_symbol,
    extended_symbol,
    edgex_contract_id,
    edgex_symbol,
    grvt_instrument,
    extended_display_symbol: opts.extended_display_symbol ?? null,
    ondo_symbol: opts.ondo_symbol ?? null,
    pacifica_symbol: opts.pacifica_symbol ?? null,
  };
}

export const ASSETS: Record<string, AssetConfig> = {
  // Commodities
  XAU: cfg("XAU/USD", "XAU", "commodity", "GOLD", 92, "XAUUSDT", "XAUUSD", "XAU-USD", 30000005, null, "XAU_USDT_Perp", { ondo_symbol: "XAU-USD.P", pacifica_symbol: "XAU" }),
  XAG: cfg("XAG/USD", "XAG", "commodity", "SILVER", 93, "XAGUSDT", "XAGUSD", "XAG-USD", 30000006, null, "XAG_USDT_Perp", { ondo_symbol: "XAG-USD.P", pacifica_symbol: "XAG" }),
  WTI: cfg("WTI/USD", "WTI", "commodity", "CL", 145, "CLUSDT", "CLUSD", "WTI-USD", 30000008, null, null, { ondo_symbol: "WTI-USD.P", pacifica_symbol: "CL" }),
  BRENT: cfg("BRENT/USD", "BRENT", "commodity", "BRENTOIL", 159, null, "BRENTUSD", "XBR-USD", 30000017, null, null, { ondo_symbol: "BRENT-USD.P" }),

  // Forex
  EURUSD: cfg("EUR/USD", "EURUSD", "forex", "EUR", 96, null, "EURUSD", "EUR-USD", null, null, null, { pacifica_symbol: "EURUSD" }),
  GBPUSD: cfg("GBP/USD", "GBPUSD", "forex", "GBP", 97, null, "GBPUSD", null, null, null, null),
  USDJPY: cfg("USD/JPY", "USDJPY", "forex", "JPY", 98, null, "USDJPY", "USDJPY-USD", null, null, null, { pacifica_symbol: "USDJPY" }),
  USDCAD: cfg("USD/CAD", "USDCAD", "forex", null, 100, null, "USDCAD", null, null, null, null),
  USDCHF: cfg("USD/CHF", "USDCHF", "forex", null, 99, null, "USDCHF", null, null, null, null),
  USDSEK: cfg("USD/SEK", "USDSEK", "forex", null, null, null, null, null, null, null, null),
  AUDUSD: cfg("AUD/USD", "AUDUSD", "forex", null, 106, null, "AUDUSD", null, null, null, null),
  NZDUSD: cfg("NZD/USD", "NZDUSD", "forex", null, 107, null, "NZDUSD", null, null, null, null),
  USDSGD: cfg("USD/SGD", "USDSGD", "forex", null, null, null, null, null, null, null, null),
  USDTRY: cfg("USD/TRY", "USDTRY", "forex", null, null, null, null, null, null, null, null),
  USDCNH: cfg("USD/CNH", "USDCNH", "forex", null, null, null, null, null, null, null, null),
  USDINR: cfg("USD/INR", "USDINR", "forex", null, null, null, null, null, null, null, null),
  USDKRW: cfg("USD/KRW", "USDKRW", "forex", "KRW", 105, null, "USDKRW", null, null, null, null),
  USDMXN: cfg("USD/MXN", "USDMXN", "forex", null, null, null, "USDMXN", null, null, null, null),
  USDZAR: cfg("USD/ZAR", "USDZAR", "forex", null, null, null, null, null, null, null, null),
  USDBRL: cfg("USD/BRL", "USDBRL", "forex", null, null, null, null, null, null, null, null),
  USDIDR: cfg("USD/IDR", "USDIDR", "forex", null, null, null, null, null, null, null, null),
  USDTWD: cfg("USD/TWD", "USDTWD", "forex", null, null, null, null, null, null, null, null),

  // MAG7 Stocks
  AAPL: cfg("AAPL/USD", "AAPL", "stock", "AAPL", 113, "AAPLUSDT", "AAPLUSD", "AAPL_24_5-USD", 30000012, null, null, { ondo_symbol: "AAPL-USD.P" }),
  MSFT: cfg("MSFT/USD", "MSFT", "stock", "MSFT", 115, "MSFTUSDT", "MSFTUSD", "MSFT_24_5-USD", 30000029, null, null, { ondo_symbol: "MSFT-USD.P" }),
  GOOG: cfg("GOOG/USD", "GOOG", "stock", "GOOGL", 116, "GOOGUSDT", "GOOGUSD", "GOOG_24_5-USD", 30000022, null, null, { ondo_symbol: "GOOGL-USD.P", pacifica_symbol: "GOOGL" }),
  AMZN: cfg("AMZN/USD", "AMZN", "stock", "AMZN", 114, "AMZNUSDT", "AMZNUSD", "AMZN_24_5-USD", 30000013, null, "AMZN_USDT_Perp", { ondo_symbol: "AMZN-USD.P" }),
  META: cfg("META/USD", "META", "stock", "META", 117, "METAUSDT", "METAUSD", "META_24_5-USD", 30000028, null, null, { ondo_symbol: "META-USD.P" }),
  NVDA: cfg("NVDA/USD", "NVDA", "stock", "NVDA", 110, "NVDAUSDT", "NVDAUSD", "NVDA_24_5-USD", 30000020, null, null, { ondo_symbol: "NVDA-USD.P", pacifica_symbol: "NVDA" }),
  TSLA: cfg("TSLA/USD", "TSLA", "stock", "TSLA", 112, "TSLAUSDT", "TSLAUSD", "TSLA_24_5-USD", 30000023, null, "TSLA_USDT_Perp", { ondo_symbol: "TSLA-USD.P", pacifica_symbol: "TSLA" }),

  // Indices
  US500: cfg("US500/USD", "US500", "index", "SP500", 180, null, "SPXUSD", "SPX500m-USD", 30000010, null, null, { extended_display_symbol: "SPX/USD", ondo_symbol: "SPY-USD.P", pacifica_symbol: "SP500" }),
  US100: cfg("US100/USD", "US100", "index", "XYZ100", 181, "QQQUSDT", "NDXUSD", "TECH100m-USD", 30000011, null, null, { extended_display_symbol: "NDX/USD", ondo_symbol: "QQQ-USD.P" }),

  // Additional equities
  COIN: cfg("COIN/USD", "COIN", "stock", "COIN", 109, null, "COINUSD", "COIN_24_5-USD", 30000025, null, "COIN_USDT_Perp", { ondo_symbol: "COIN-USD.P" }),
  HOOD: cfg("HOOD/USD", "HOOD", "stock", "HOOD", 108, "HOODUSDT", "HOODUSD", "HOOD_24_5-USD", 30000027, null, "HOOD_USDT_Perp", { ondo_symbol: "HOOD-USD.P", pacifica_symbol: "HOOD" }),
  SPCX: cfg("SPCX/USD", "SPCX", "stock", "SPCX", 194, "SPCXUSDT", null, "SPCX-USD", 30000076, null, "SPCX_USDT_Perp", { extended_display_symbol: "SPCX/USD", ondo_symbol: "SPCX-USD.P", pacifica_symbol: "SPCX" }),
  AMD: cfg("AMD/USD", "AMD", "stock", "AMD", 138, "AMDUSDT", "AMDUSD", "AMD_24_5-USD", 30000021, null, "AMD_USDT_Perp", { ondo_symbol: "AMD-USD.P" }),
  INTC: cfg("INTC/USD", "INTC", "stock", "INTC", 137, "INTCUSDT", "INTCUSD", "INTC_24_5-USD", 30000032, null, "INTC_USDT_Perp", { ondo_symbol: "INTC-USD.P" }),
  MU: cfg("MU/USD", "MU", "stock", "MU", 164, "MUUSDT", "MUUSD", "MU_24_5-USD", 30000035, null, "MU_USDT_Perp", { ondo_symbol: "MU-USD.P", pacifica_symbol: "MU" }),
  SNDK: cfg("SNDK/USD", "SNDK", "stock", "SNDK", 139, "SNDKUSDT", "SNDKUSD", "SNDK_24_5-USD", 30000034, null, "SNDK_USDT_Perp", { ondo_symbol: "SNDK-USD.P", pacifica_symbol: "SNDK" }),
  CBRS: cfg("CBRS/USD", "CBRS", "stock", "CBRS", 175, "CBRSUSDT", null, "CBRS_24_5-USD", 30000078, null, "CBRS_USDT_Perp", { ondo_symbol: "CBRS-USD.P" }),
  EWY: cfg("EWY/USD", "EWY", "stock", "EWY", 166, "EWYUSDT", null, "EWY_24_5-USD", 30000018, null, "EWY_USDT_Perp", { ondo_symbol: "EWY-USD.P" }),
  BABA: cfg("BABA/USD", "BABA", "stock", "BABA", 177, "BABAUSDT", null, "BABA_24_5-USD", null, null, "BABA_USDT_Perp", { ondo_symbol: "BABA-USD.P" }),
  CRCL: cfg("CRCL/USD", "CRCL", "stock", "CRCL", 121, "CRCLUSDT", "CRCLUSD", "CRCL_24_5-USD", 30000026, null, "CRCL_USDT_Perp", { ondo_symbol: "CRCL-USD.P", pacifica_symbol: "CRCL" }),
  MRVL: cfg("MRVL/USD", "MRVL", "stock", "MRVL", 174, "MRVLUSDT", null, "MRVL-USD", 30000077, null, "MRVL_USDT_Perp", { ondo_symbol: "MRVL-USD.P" }),
  MSTR: cfg("MSTR/USD", "MSTR", "stock", "MSTR", 122, "MSTRUSDT", "MSTRUSD", "MSTR_24_5-USD", 30000014, null, "MSTR_USDT_Perp", { ondo_symbol: "MSTR-USD.P", pacifica_symbol: "MSTR" }),
  BB: cfg("BB/USD", "BB", "stock", "BB", 211, "BBUSDT", "BBUSD", "BB-USD", null, null, null, { ondo_symbol: "BB-USD.P" }),
  PLTR: cfg("PLTR/USD", "PLTR", "stock", "PLTR", 111, "PLTRUSDT", "PLTRUSD", "PLTR_24_5-USD", 30000030, null, "PLTR_USDT_Perp", { ondo_symbol: "PLTR-USD.P", pacifica_symbol: "PLTR" }),
  AVGO: cfg("AVGO/USD", "AVGO", "stock", "AVGO", 210, "AVGOUSDT", "AVGOUSD", "AVGO-USD", 30000024, null, "AVGO_USDT_Perp", { ondo_symbol: "AVGO-USD.P" }),
  NFLX: cfg("NFLX/USD", "NFLX", "stock", "NFLX", null, "NFLXUSDT", "NFLXUSD", null, null, null, "NFLX_USDT_Perp", { ondo_symbol: "NFLX-USD.P" }),
  CRWV: cfg("CRWV/USD", "CRWV", "stock", "CRWV", 167, "CRWVUSDT", null, "CRWV-USD", 30000031, null, "CRWV_USDT_Perp", { ondo_symbol: "CRWV-USD.P" }),
  SKHY: cfg("SKHY/USD", "SKHY", "stock", "SKHY", 216, "SKHYUSDT", "SKHYUSD", "SKHY-USD", 30000087, null, "SKHY_USDT_Perp", { ondo_symbol: "SKHY-USD.P" }),

  LLY: cfg("LLY/USD", "LLY", "stock", "LLY", null, "LLYUSDT", "LLYUSD", null, null, null, "LLY_USDT_Perp"),
  BE: cfg("BE/USD", "BE", "stock", "BE", null, "BEUSDT", null, "BE-USD", null, null, "BE_USDT_Perp"),
  LITE: cfg("LITE/USD", "LITE", "stock", "LITE", 178, "LITEUSDT", null, "LITE-USD", 30000033, null, "LITE_USDT_Perp", { ondo_symbol: "LITE-USD.P" }),
  STRC: cfg("STRC/USD", "STRC", "stock", "STRC", 156, "STRCUSDT", null, null, null, null, "STRC_USDT_Perp"),
  DELL: cfg("DELL/USD", "DELL", "stock", "DELL", 187, "DELLUSDT", "DELLUSD", "DELL-USD", 30000157, null, "DELL_USDT_Perp"),
  NBIS: cfg("NBIS/USD", "NBIS", "stock", "NBIS", 189, "NBISUSDT", "NBISUSD", "NBIS-USD", 30000142, null, "NBIS_USDT_Perp", { ondo_symbol: "NBIS-USD.P" }),
  IREN: cfg("IREN/USD", "IREN", "stock", "IREN", null, "IRENUSDT", null, "IREN_24_5-USD", null, null, "IREN_USDT_Perp"),
  ARM: cfg("ARM/USD", "ARM", "stock", "ARM", null, "ARMUSDT", "ARMUSD", "ARM-USD", 30000156, null, "ARM_USDT_Perp", { ondo_symbol: "ARM-USD.P" }),
  MRNA: cfg("MRNA/USD", "MRNA", "stock", "MRNA", 228, "MRNAUSDT", "MRNAUSD", "MRNA-USD", 30000159, null, "MRNA_USDT_Perp", { ondo_symbol: "MRNA-USD.P" }),
  RKLB: cfg("RKLB/USD", "RKLB", "stock", "RKLB", 186, "RKLBUSDT", null, "RKLB-USD", 30000036, null, "RKLB_USDT_Perp"),
  WDC: cfg("WDC/USD", "WDC", "stock", "WDC", null, "WDCUSDT", null, "WDC-USD", 30000150, null, "WDC_USDT_Perp"),
  NOW: cfg("NOW/USD", "NOW", "stock", "NOW", 191, "NOWUSDT", null, null, null, null, "NOW_USDT_Perp"),
  AMGN: cfg("AMGN/USD", "AMGN", "stock", null, null, null, null, "AMGN-USD", null),
  CSCO: cfg("CSCO/USD", "CSCO", "stock", null, null, "CSCOUSDT", null, "CSCO_24_5-USD", null, null, "CSCO_USDT_Perp"),
  KLAC: cfg("KLAC/USD", "KLAC", "stock", null, null, null, null, "KLAC_24_5-USD", null),
  LRCX: cfg("LRCX/USD", "LRCX", "stock", "LRCX", null, null, null, "LRCX_24_5-USD", null),
  TXN: cfg("TXN/USD", "TXN", "stock", null, null, null, null, "TXN-USD", null),
  PANW: cfg("PANW/USD", "PANW", "stock", null, null, null, null, null, null),
  APP: cfg("APP/USD", "APP", "stock", null, null, null, null, "APP_24_5-USD", null),
  ALAB: cfg("ALAB/USD", "ALAB", "stock", null, null, null, null, "ALAB_24_5-USD", null),
  DDOG: cfg("DDOG/USD", "DDOG", "stock", null, null, null, null, "DDOG-USD", null),
  CEG: cfg("CEG/USD", "CEG", "stock", null, null, null, null, "CEG-USD", null),
  SNPS: cfg("SNPS/USD", "SNPS", "stock", null, null, null, null, "SNPS-USD", null),
  CDNS: cfg("CDNS/USD", "CDNS", "stock", null, null, null, null, "CDNS-USD", null),
  MPWR: cfg("MPWR/USD", "MPWR", "stock", null, null, null, null, "MPWR-USD", null),
  FTNT: cfg("FTNT/USD", "FTNT", "stock", null, null, null, null, "FTNT-USD", null),
  ADBE: cfg("ADBE/USD", "ADBE", "stock", null, null, "ADBEUSDT", null, "ADBE_24_5-USD", null),
  INTU: cfg("INTU/USD", "INTU", "stock", null, null, null, null, "INTU-USD", null),
  ADI: cfg("ADI/USD", "ADI", "stock", null, null, null, null, "ADI-USD", null),
  TER: cfg("TER/USD", "TER", "stock", null, null, null, null, "TER_24_5-USD", null),
  NXPI: cfg("NXPI/USD", "NXPI", "stock", null, null, null, null, "NXPI-USD", null),
  SHOP: cfg("SHOP/USD", "SHOP", "stock", null, null, null, null, "SHOP-USD", 30000155),
  WDAY: cfg("WDAY/USD", "WDAY", "stock", null, null, null, null, null, null),
  ADSK: cfg("ADSK/USD", "ADSK", "stock", null, null, null, null, "ADSK-USD", null),
  MCHP: cfg("MCHP/USD", "MCHP", "stock", null, null, null, null, "MCHP-USD", null),
  BKNG: cfg("BKNG/USD", "BKNG", "stock", null, null, null, null, "BKNG-USD", null),
  MELI: cfg("MELI/USD", "MELI", "stock", null, null, null, null, "MELI-USD", null),
  ISRG: cfg("ISRG/USD", "ISRG", "stock", null, null, null, null, "ISRG-USD", null),
  TMUS: cfg("TMUS/USD", "TMUS", "stock", null, null, null, null, "TMUS-USD", null),
  ABNB: cfg("ABNB/USD", "ABNB", "stock", null, null, null, null, "ABNB-USD", null),
  DASH: cfg("DASH/USD", "DASH", "stock", null, null, null, null, null, null),
  PDD: cfg("PDD/USD", "PDD", "stock", null, null, null, null, "PDD_24_5-USD", 30000163),
  PYPL: cfg("PYPL/USD", "PYPL", "stock", null, null, null, null, null, 30000122),
  TTWO: cfg("TTWO/USD", "TTWO", "stock", null, 179, null, null, "TTWO-USD", null, null, null, { ondo_symbol: "TTWO-USD.P" }),
  WMT: cfg("WMT/USD", "WMT", "stock", null, null, "WMTUSDT", null, "WMT-USD", 30000127, null, "WMT_USDT_Perp"),
  GILD: cfg("GILD/USD", "GILD", "stock", null, null, null, null, null, null),
  VRTX: cfg("VRTX/USD", "VRTX", "stock", null, null, null, null, "VRTX-USD", null),
  REGN: cfg("REGN/USD", "REGN", "stock", null, null, null, null, "REGN-USD", null),
  LIN: cfg("LIN/USD", "LIN", "stock", null, null, null, null, "LIN-USD", null),
  ADP: cfg("ADP/USD", "ADP", "stock", null, null, null, null, null, null),
  HON: cfg("HON/USD", "HON", "stock", null, null, null, null, "HON-USD", null),
  STX: cfg("STX/USD", "STX", "stock", null, null, null, null, null, null),
  AXON: cfg("AXON/USD", "AXON", "stock", null, null, null, null, "AXON-USD", null),
  VST: cfg("VST/USD", "VST", "stock", null, null, null, null, null, 30000154),
  ANET: cfg("ANET/USD", "ANET", "stock", null, null, null, null, null, null),
  UBER: cfg("UBER/USD", "UBER", "stock", null, null, "UBERUSDT", null, null, null, null, "UBER_USDT_Perp"),
  BA: cfg("BA/USD", "BA", "stock", null, null, null, null, null, null),
  SOFI: cfg("SOFI/USD", "SOFI", "stock", null, null, null, null, "SOFI-USD", 30000106),
  GRAB: cfg("GRAB/USD", "GRAB", "stock", null, null, null, null, null, null),
  ASTS: cfg("ASTS/USD", "ASTS", "stock", null, null, "ASTSUSDT", null, "ASTS-USD", null, null, "ASTS_USDT_Perp"),
  BOT: cfg("BOT/USD", "BOT", "stock", "BOT", 185, null, null, null, null),

  // Korean equities (/KRW on Veranta)
  SAMSUNGKRW: cfg("005930/KRW Samsung Electronics", "SAMSUNGKRW", "stock", null, null, null, null, null, null),
  HYUNDAIKRW: cfg("005380/KRW Hyundai Motor", "HYUNDAIKRW", "stock", null, null, null, null, null, null),
  NAVERKRW: cfg("035420/KRW NAVER", "NAVERKRW", "stock", null, null, null, null, null, null),
  LGELECKRW: cfg("066570/KRW LG Electronics", "LGELECKRW", "stock", null, null, null, null, null, null),
  HANMIKRW: cfg("042700/KRW Hanmi Semiconductor", "HANMIKRW", "stock", null, null, null, null, null, null),
  SAMSUNGEMKRW: cfg("009150/KRW Samsung Electro-Mechanics", "SAMSUNGEMKRW", "stock", null, null, null, null, null, null),
  KODEX200KRW: cfg("069500/KRW KODEX 200", "KODEX200KRW", "stock", null, null, null, null, null, null),
  HYUNDAISTEELKRW: cfg("004020/KRW Hyundai Steel", "HYUNDAISTEELKRW", "stock", null, null, null, null, null, null),
  NHISKRW: cfg("005940/KRW NH Investment & Securities", "NHISKRW", "stock", null, null, null, null, null, null),
  HDKSOEKRW: cfg("009540/KRW HD Korea Shipbuilding", "HDKSOEKRW", "stock", null, null, null, null, null, null),
  HMMKRW: cfg("011200/KRW HMM", "HMMKRW", "stock", null, null, null, null, null, null),
  SKINCKRW: cfg("034730/KRW SK Inc", "SKINCKRW", "stock", null, null, null, null, null, null),
  KAKAOKRW: cfg("035720/KRW Kakao", "KAKAOKRW", "stock", null, null, null, null, null, null),
  LGCHEMKRW: cfg("051910/KRW LG Chem", "LGCHEMKRW", "stock", null, null, null, null, null, null),
  KRAFTONKRW: cfg("259960/KRW Krafton", "KRAFTONKRW", "stock", null, null, null, null, null, null),
  HANWHASYSKRW: cfg("272210/KRW Hanwha Systems", "HANWHASYSKRW", "stock", null, null, null, null, null, null),
  LGESKRW: cfg("373220/KRW LG Energy Solution", "LGESKRW", "stock", null, null, null, null, null, null),

  // Korean equities (/USD on other venues)
  SAMSUNG: cfg("SAMSUNG/USD Samsung Electronics", "SAMSUNG", "stock", "SMSN", 162, "SAMSUNGUSDT", null, "SAMSUNG-USD", 30000079, null, "SAMSUNG_USDT_Perp", { ondo_symbol: "SMSN-USD.P", pacifica_symbol: "SAMSUNG" }),
  HYUNDAI: cfg("HYUNDAI/USD Hyundai Motor", "HYUNDAI", "stock", "HYUNDAI", 160, "HYUNDAIUSDT", null, null, null, null, "HYUNDAI_USDT_Perp"),
  NAVER: cfg("NAVER/USD NAVER", "NAVER", "stock", null, null, null, null, null, 30000145, null, "NAVER_USDT_Perp"),
  LGELEC: cfg("LGELEC/USD LG Electronics", "LGELEC", "stock", null, null, null, null, null, 30000146, null, "LGELECTRONICS_USDT_Perp"),
  HANMI: cfg("HANMI/USD Hanmi Semiconductor", "HANMI", "stock", null, null, null, null, null, 30000147, null, "HANMI_USDT_Perp"),
  SAMSUNGEM: cfg("SAMSUNGEM/USD Samsung Electro-Mechanics", "SAMSUNGEM", "stock", null, null, null, null, null, 30000148, null, "SAMSUNGEM_USDT_Perp"),
  KODEX200: cfg("KODEX200/USD KODEX 200", "KODEX200", "stock", "KR200", null, null, null, "KR200-USD", 30000149, null, "KODEX200_USDT_Perp", { extended_display_symbol: "KR200/USD" }),
};

export interface OrderbookLevel {
  price: number;
  qty: number;
}

export interface StandardizedOrderbook {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  best_bid: number;
  best_ask: number;
  mid_price: number;
  timestamp: number;
  max_leverage?: number | null;
}

export interface WalkSideResult {
  filled: boolean;
  filled_usd: number;
  unfilled_usd: number;
  levels_used: number;
  avg_price: number;
  slippage_bps: number;
}

export class ExecutionCalculator {
  static walkBook(
    levels: OrderbookLevel[],
    orderSizeUsd: number,
    midPrice: number,
    side: "buy" | "sell" = "buy"
  ): WalkSideResult | null {
    if (!levels || levels.length === 0) return null;

    const sortedLevels = [...levels].sort((a, b) =>
      side === "sell" ? b.price - a.price : a.price - b.price
    );

    let unfilledUsd = orderSizeUsd;
    let totalQty = 0;
    let totalCost = 0;
    let levelsUsed = 0;

    for (const level of sortedLevels) {
      const { price, qty } = level;
      if (price <= 0 || qty <= 0) continue;

      const valueAvailable = price * qty;
      if (unfilledUsd <= valueAvailable) {
        const qtyNeeded = unfilledUsd / price;
        totalQty += qtyNeeded;
        totalCost += unfilledUsd;
        unfilledUsd = 0;
        levelsUsed += 1;
        break;
      } else {
        totalQty += qty;
        totalCost += valueAvailable;
        unfilledUsd -= valueAvailable;
        levelsUsed += 1;
      }
    }

    const filledUsd = orderSizeUsd - unfilledUsd;
    const avgPrice = totalQty > 0 ? totalCost / totalQty : 0;
    const slippageBps =
      midPrice > 0 ? Math.abs((avgPrice - midPrice) / midPrice) * 10000 : 0;

    return {
      filled: unfilledUsd === 0,
      filled_usd: filledUsd,
      unfilled_usd: unfilledUsd,
      levels_used: levelsUsed,
      avg_price: avgPrice,
      slippage_bps: slippageBps,
    };
  }

  static calculateExecutionCost(
    orderbook: StandardizedOrderbook | null,
    orderSizeUsd: number,
    openFeeBps: number = 0,
    closeFeeBps: number = 0
  ): Record<string, any> | null {
    if (
      !orderbook ||
      !orderbook.bids?.length ||
      !orderbook.asks?.length
    ) {
      return null;
    }

    const midPrice = orderbook.mid_price;
    const buyResult = ExecutionCalculator.walkBook(
      orderbook.asks,
      orderSizeUsd,
      midPrice,
      "buy"
    );
    const sellResult = ExecutionCalculator.walkBook(
      orderbook.bids,
      orderSizeUsd,
      midPrice,
      "sell"
    );

    if (!buyResult || !sellResult) return null;

    const buySlippageBps = buyResult.slippage_bps;
    const sellSlippageBps = sellResult.slippage_bps;
    const avgSlippageBps = (buySlippageBps + sellSlippageBps) / 2;
    const filled = buyResult.filled && sellResult.filled;

    const buyPartial = !buyResult.filled;
    const sellPartial = !sellResult.filled;
    const unfilledSide =
      buyPartial && sellPartial
        ? "both"
        : buyPartial
        ? "buy"
        : sellPartial
        ? "sell"
        : null;

    const totalCostBps = avgSlippageBps + openFeeBps + closeFeeBps;

    return {
      executed: filled ? true : "PARTIAL",
      mid_price: midPrice,
      best_bid: orderbook.best_bid,
      best_ask: orderbook.best_ask,
      slippage_bps: avgSlippageBps,
      buy_slippage_bps: buySlippageBps,
      sell_slippage_bps: sellSlippageBps,
      open_fee_bps: openFeeBps,
      close_fee_bps: closeFeeBps,
      total_cost_bps: totalCostBps,
      filled,
      order_size_usd: orderSizeUsd,
      filled_usd: Math.min(buyResult.filled_usd, sellResult.filled_usd),
      unfilled_usd: Math.max(buyResult.unfilled_usd, sellResult.unfilled_usd),
      unfilled_side: unfilledSide,
      buy: buyResult,
      sell: sellResult,
      timestamp: orderbook.timestamp,
    };
  }
}
