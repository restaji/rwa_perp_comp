export interface Venue {
  id: string;
  name: string;
  logo: string;
  maxLeverage: number;
  openingSpreadBps: number;
  openingSlippageBps: number;
  closingSlippageBps: number;
  feeBps: number;
  updatedAt: string;
  symbol?: string;
  hasInsufficientLiquidity?: boolean;
  availableLiquidityUsd?: number;
  maxBuyUsd?: number;
  maxSellUsd?: number;
  // Holding / funding fee fields (% of notional per period)
  fundingFee1hPct?: number;
  fundingFee24hPct?: number;
  // Directional holding fees (Veranta, Ostium)
  fundingFee1hLongPct?: number;
  fundingFee1hShortPct?: number;
  fundingFee24hLongPct?: number;
  fundingFee24hShortPct?: number;
}

export type AssetCategory = "Commodities" | "Forex" | "Equities" | "Indices";

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  category: AssetCategory;
}

const COMMODITY_KEYS = new Set(["XAU", "XAG", "WTI", "BRENT"]);
const INDEX_KEYS = new Set(["SPY", "QQQ", "US500", "US100", "EWY", "KODEX200"]);

export function categorizeAsset(key: string): AssetCategory {
  if (COMMODITY_KEYS.has(key)) return "Commodities";
  if (INDEX_KEYS.has(key)) return "Indices";
  if (/^(USD[A-Z]{3}|[A-Z]{3}USD)$/.test(key)) return "Forex";
  return "Equities";
}

// Assets matching the Python backend /api/assets list
export const ASSETS: Asset[] = [
  // Commodities
  { id: "XAU",   symbol: "XAU/USD",   name: "Gold",             category: "Commodities" },
  { id: "XAG",   symbol: "XAG/USD",   name: "Silver",           category: "Commodities" },
  { id: "WTI",   symbol: "WTI/USD",   name: "WTI Crude Oil",    category: "Commodities" },
  { id: "BRENT", symbol: "BRENT/USD", name: "Brent Crude Oil",  category: "Commodities" },
  // Forex
  { id: "EURUSD", symbol: "EUR/USD", name: "Euro",               category: "Forex" },
  { id: "GBPUSD", symbol: "GBP/USD", name: "British Pound",      category: "Forex" },
  { id: "USDJPY", symbol: "USD/JPY", name: "Japanese Yen",       category: "Forex" },
  { id: "USDCAD", symbol: "USD/CAD", name: "Canadian Dollar",    category: "Forex" },
  { id: "USDCHF", symbol: "USD/CHF", name: "Swiss Franc",        category: "Forex" },
  { id: "AUDUSD", symbol: "AUD/USD", name: "Australian Dollar",  category: "Forex" },
  { id: "NZDUSD", symbol: "NZD/USD", name: "New Zealand Dollar", category: "Forex" },
  { id: "USDSEK", symbol: "USD/SEK", name: "Swedish Krona",      category: "Forex" },
  { id: "USDSGD", symbol: "USD/SGD", name: "Singapore Dollar",   category: "Forex" },
  { id: "USDTRY", symbol: "USD/TRY", name: "Turkish Lira",       category: "Forex" },
  { id: "USDCNH", symbol: "USD/CNH", name: "Chinese Yuan (Offshore)", category: "Forex" },
  { id: "USDINR", symbol: "USD/INR", name: "Indian Rupee",       category: "Forex" },
  { id: "USDKRW", symbol: "USD/KRW", name: "South Korean Won",   category: "Forex" },
  { id: "USDMXN", symbol: "USD/MXN", name: "Mexican Peso",       category: "Forex" },
  { id: "USDZAR", symbol: "USD/ZAR", name: "South African Rand", category: "Forex" },
  { id: "USDBRL", symbol: "USD/BRL", name: "Brazilian Real",     category: "Forex" },
  { id: "USDIDR", symbol: "USD/IDR", name: "Indonesian Rupiah",  category: "Forex" },
  { id: "USDTWD", symbol: "USD/TWD", name: "Taiwan Dollar",      category: "Forex" },
  // Equities + Indices
  { id: "AAPL", symbol: "AAPL/USD", name: "Apple",           category: "Equities" },
  { id: "MSFT", symbol: "MSFT/USD", name: "Microsoft",       category: "Equities" },
  { id: "GOOG", symbol: "GOOG/USD", name: "Google",          category: "Equities" },
  { id: "AMZN", symbol: "AMZN/USD", name: "Amazon",          category: "Equities" },
  { id: "META", symbol: "META/USD", name: "Meta",            category: "Equities" },
  { id: "NVDA", symbol: "NVDA/USD", name: "Nvidia",          category: "Equities" },
  { id: "TSLA", symbol: "TSLA/USD", name: "Tesla",           category: "Equities" },
  { id: "US500", symbol: "US500/USD", name: "S&P 500",         category: "Indices" },
  { id: "US100", symbol: "US100/USD", name: "Nasdaq 100",      category: "Indices" },
  { id: "COIN", symbol: "COIN/USD", name: "Coinbase",        category: "Equities" },
  { id: "HOOD", symbol: "HOOD/USD", name: "Robinhood",       category: "Equities" },
  { id: "SPCX", symbol: "SPCX/USD", name: "SpaceX",          category: "Equities" },
  { id: "AMD",  symbol: "AMD/USD",  name: "AMD",             category: "Equities" },
  { id: "INTC", symbol: "INTC/USD", name: "Intel",           category: "Equities" },
  { id: "MU",   symbol: "MU/USD",   name: "Micron",          category: "Equities" },
  { id: "SNDK", symbol: "SNDK/USD", name: "SanDisk",         category: "Equities" },
  { id: "CBRS", symbol: "CBRS/USD", name: "Cerebras",        category: "Equities" },
  { id: "EWY",  symbol: "EWY/USD",  name: "South Korea ETF", category: "Indices" },
  { id: "BABA", symbol: "BABA/USD", name: "Alibaba",         category: "Equities" },
  { id: "CRCL", symbol: "CRCL/USD", name: "Circle",          category: "Equities" },
  { id: "MRVL", symbol: "MRVL/USD", name: "Marvell",         category: "Equities" },
  { id: "MSTR", symbol: "MSTR/USD", name: "MicroStrategy",   category: "Equities" },
  { id: "BB",   symbol: "BB/USD",   name: "BlackBerry",      category: "Equities" },
  { id: "PLTR", symbol: "PLTR/USD", name: "Palantir",        category: "Equities" },
  { id: "AVGO", symbol: "AVGO/USD", name: "Broadcom",        category: "Equities" },
  { id: "NFLX", symbol: "NFLX/USD", name: "Netflix",         category: "Equities" },
  { id: "CRWV", symbol: "CRWV/USD", name: "CoreWeave",       category: "Equities" },
  { id: "SKHY", symbol: "SKHY/USD", name: "SK Hynix",        category: "Equities" },
  { id: "LLY",  symbol: "LLY/USD",  name: "Eli Lilly",          category: "Equities" },
  { id: "BE",   symbol: "BE/USD",   name: "Bloom Energy",       category: "Equities" },
  { id: "LITE", symbol: "LITE/USD", name: "Lumentum",           category: "Equities" },
  { id: "STRC", symbol: "STRC/USD", name: "Strategy Stretch Preferred", category: "Equities" },
  { id: "DELL", symbol: "DELL/USD", name: "Dell",               category: "Equities" },
  { id: "NBIS", symbol: "NBIS/USD", name: "Nebius",             category: "Equities" },
  { id: "IREN", symbol: "IREN/USD", name: "IREN",               category: "Equities" },
  { id: "ARM",  symbol: "ARM/USD",  name: "Arm Holdings",       category: "Equities" },
  { id: "MRNA", symbol: "MRNA/USD", name: "Moderna",            category: "Equities" },
  { id: "RKLB", symbol: "RKLB/USD", name: "Rocket Lab",         category: "Equities" },
  { id: "WDC",  symbol: "WDC/USD",  name: "Western Digital",    category: "Equities" },
  { id: "NOW",  symbol: "NOW/USD",  name: "ServiceNow",         category: "Equities" },
  { id: "AMGN", symbol: "AMGN/USD", name: "Amgen",              category: "Equities" },
  { id: "CSCO", symbol: "CSCO/USD", name: "Cisco",              category: "Equities" },
  { id: "KLAC", symbol: "KLAC/USD", name: "KLA",                category: "Equities" },
  { id: "LRCX", symbol: "LRCX/USD", name: "Lam Research",       category: "Equities" },
  { id: "TXN",  symbol: "TXN/USD",  name: "Texas Instruments",  category: "Equities" },
  { id: "PANW", symbol: "PANW/USD", name: "Palo Alto Networks", category: "Equities" },
  { id: "APP",  symbol: "APP/USD",  name: "AppLovin",           category: "Equities" },
  { id: "ALAB", symbol: "ALAB/USD", name: "Astera Labs",        category: "Equities" },
  { id: "DDOG", symbol: "DDOG/USD", name: "Datadog",            category: "Equities" },
  { id: "CEG",  symbol: "CEG/USD",  name: "Constellation Energy", category: "Equities" },
  { id: "SNPS", symbol: "SNPS/USD", name: "Synopsys",           category: "Equities" },
  { id: "CDNS", symbol: "CDNS/USD", name: "Cadence Design",     category: "Equities" },
  { id: "MPWR", symbol: "MPWR/USD", name: "Monolithic Power",   category: "Equities" },
  { id: "FTNT", symbol: "FTNT/USD", name: "Fortinet",           category: "Equities" },
  { id: "ADBE", symbol: "ADBE/USD", name: "Adobe",              category: "Equities" },
  { id: "INTU", symbol: "INTU/USD", name: "Intuit",             category: "Equities" },
  { id: "ADI",  symbol: "ADI/USD",  name: "Analog Devices",     category: "Equities" },
  { id: "TER",  symbol: "TER/USD",  name: "Teradyne",           category: "Equities" },
  { id: "NXPI", symbol: "NXPI/USD", name: "NXP Semiconductors", category: "Equities" },
  { id: "SHOP", symbol: "SHOP/USD", name: "Shopify",            category: "Equities" },
  { id: "WDAY", symbol: "WDAY/USD", name: "Workday",            category: "Equities" },
  { id: "ADSK", symbol: "ADSK/USD", name: "Autodesk",           category: "Equities" },
  { id: "MCHP", symbol: "MCHP/USD", name: "Microchip",          category: "Equities" },
  { id: "BKNG", symbol: "BKNG/USD", name: "Booking Holdings",   category: "Equities" },
  { id: "MELI", symbol: "MELI/USD", name: "MercadoLibre",       category: "Equities" },
  { id: "ISRG", symbol: "ISRG/USD", name: "Intuitive Surgical", category: "Equities" },
  { id: "TMUS", symbol: "TMUS/USD", name: "T-Mobile US",        category: "Equities" },
  { id: "ABNB", symbol: "ABNB/USD", name: "Airbnb",             category: "Equities" },
  { id: "DASH", symbol: "DASH/USD", name: "DoorDash",           category: "Equities" },
  { id: "PDD",  symbol: "PDD/USD",  name: "PDD Holdings",       category: "Equities" },
  { id: "PYPL", symbol: "PYPL/USD", name: "PayPal",             category: "Equities" },
  { id: "TTWO", symbol: "TTWO/USD", name: "Take-Two Interactive", category: "Equities" },
  { id: "WMT",  symbol: "WMT/USD",  name: "Walmart",            category: "Equities" },
  { id: "GILD", symbol: "GILD/USD", name: "Gilead Sciences",    category: "Equities" },
  { id: "VRTX", symbol: "VRTX/USD", name: "Vertex Pharmaceuticals", category: "Equities" },
  { id: "REGN", symbol: "REGN/USD", name: "Regeneron",          category: "Equities" },
  { id: "LIN",  symbol: "LIN/USD",  name: "Linde",              category: "Equities" },
  { id: "ADP",  symbol: "ADP/USD",  name: "ADP",                category: "Equities" },
  { id: "HON",  symbol: "HON/USD",  name: "Honeywell",          category: "Equities" },
  { id: "STX",  symbol: "STX/USD",  name: "Seagate",            category: "Equities" },
  { id: "AXON", symbol: "AXON/USD", name: "Axon Enterprise",    category: "Equities" },
  { id: "VST",  symbol: "VST/USD",  name: "Vistra",             category: "Equities" },
  { id: "ANET", symbol: "ANET/USD", name: "Arista Networks",    category: "Equities" },
  { id: "UBER", symbol: "UBER/USD", name: "Uber",               category: "Equities" },
  { id: "BA",   symbol: "BA/USD",   name: "Boeing",             category: "Equities" },
  { id: "SOFI", symbol: "SOFI/USD", name: "SoFi",               category: "Equities" },
  { id: "GRAB", symbol: "GRAB/USD", name: "Grab",               category: "Equities" },
  { id: "ASTS", symbol: "ASTS/USD", name: "AST SpaceMobile",    category: "Equities" },
  // Korea
  { id: "SAMSUNG",      symbol: "SAMSUNG/USD",      name: "Samsung Electronics",        category: "Equities" },
  { id: "HYUNDAI",      symbol: "HYUNDAI/USD",      name: "Hyundai Motor",              category: "Equities" },
  { id: "NAVER",        symbol: "NAVER/USD",        name: "NAVER",                      category: "Equities" },
  { id: "LGELEC",       symbol: "LGELEC/USD",       name: "LG Electronics",             category: "Equities" },
  { id: "HANMI",        symbol: "HANMI/USD",        name: "Hanmi Semiconductor",        category: "Equities" },
  { id: "SAMSUNGEM",    symbol: "SAMSUNGEM/USD",    name: "Samsung Electro-Mechanics",  category: "Equities" },
  { id: "KODEX200",     symbol: "KODEX200/USD",     name: "KODEX 200 ETF",              category: "Indices" },
  { id: "HYUNDAISTEEL", symbol: "HYUNDAISTEEL/USD", name: "Hyundai Steel",              category: "Equities" },
  { id: "NHIS",         symbol: "NHIS/USD",         name: "NH Investment & Securities", category: "Equities" },
  { id: "HDKSOE",       symbol: "HDKSOE/USD",       name: "HD Korea Shipbuilding",      category: "Equities" },
  { id: "HMM",          symbol: "HMM/USD",          name: "HMM",                        category: "Equities" },
  { id: "SKINC",        symbol: "SKINC/USD",        name: "SK Inc",                     category: "Equities" },
  { id: "KAKAO",        symbol: "KAKAO/USD",        name: "Kakao",                      category: "Equities" },
  { id: "LGCHEM",       symbol: "LGCHEM/USD",       name: "LG Chem",                    category: "Equities" },
  { id: "KRAFTON",      symbol: "KRAFTON/USD",      name: "Krafton",                    category: "Equities" },
  { id: "HANWHASYS",    symbol: "HANWHASYS/USD",    name: "Hanwha Systems",             category: "Equities" },
  { id: "LGES",         symbol: "LGES/USD",         name: "LG Energy Solution",         category: "Equities" },
];

export const ORDER_SIZES = [
  { label: "$10K", value: 10000 },
  { label: "$100K", value: 100000 },
  { label: "$1M", value: 1000000 },
  { label: "$10M", value: 10000000 },
];
