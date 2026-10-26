/**
 * API client for RWA Fee Comparison Python backend.
 *
 * Calls the Flask API and transforms the response into the
 * Venue[] shape expected by the UI components.
 */

import { Asset, ASSETS, Venue, VenueType, categorizeAsset } from "./mockVenues";

export const API_BASE = (
    process.env.NEXT_PUBLIC_API_URL || ""
).replace(/\/+$/, "");

const EXCHANGE_META: Record<string, { name: string; logo: string; venueType: VenueType }> = {
    hyperliquid: { name: "Hyperliquid", logo: "/logos/hyperliquid.png", venueType: "dex" },
    lighter: { name: "Lighter", logo: "/logos/lighter.png", venueType: "dex" },
    aster: { name: "Aster", logo: "/logos/aster.jpg", venueType: "dex" },
    veranta: { name: "Veranta", logo: "/logos/veranta.png", venueType: "dex" },
    extended: { name: "Extended", logo: "/logos/extended.png", venueType: "dex" },
    edgex: { name: "EdgeX", logo: "/logos/edgex.png", venueType: "dex" },
    grvt: { name: "GRVT", logo: "/logos/grvt.png", venueType: "dex" },
    variational: { name: "Variational (Perp)", logo: "/logos/variational.png", venueType: "dex" },
    variational_swap: { name: "Variational (Swap)", logo: "/logos/variational.png", venueType: "dex" },
    ondo: { name: "Ondo Perps", logo: "/logos/ondo.png", venueType: "dex" },
    pacifica: { name: "Pacifica", logo: "/logos/pacifica.png", venueType: "dex" },
    risex: { name: "RISEx", logo: "/logos/risex.png", venueType: "dex" },
    txflow: { name: "TxFlow", logo: "/logos/txflow.png", venueType: "dex" },
    binance: { name: "Binance", logo: "/logos/binance.png", venueType: "cex" },
    bybit: { name: "Bybit", logo: "/logos/bybit.png", venueType: "cex" },
    bitget: { name: "Bitget", logo: "/logos/bitget.png", venueType: "cex" },
};

const EXCHANGE_KEYS = Object.keys(EXCHANGE_META);
const CEX_KEYS = new Set(
    Object.entries(EXCHANGE_META)
        .filter(([, meta]) => meta.venueType === "cex")
        .map(([key]) => key)
);
const VERANTA_KEYS = new Set(["avantis", "avantis_x", "veranta"]);
const ASSET_BY_ID = new Map(ASSETS.map((asset) => [asset.id, asset]));

interface BackendAsset {
    key: string;
    name?: string;
    symbol?: string;
    exchanges?: Record<string, boolean | null>;
}

interface AssetsAPIResponse {
    assets?: BackendAsset[];
}

interface ExchangeResultSide {
    filled?: boolean;
    filled_usd?: number;
    unfilled_usd?: number;
}

interface ExchangeResult {
    opening_slippage_bps?: number;
    closing_slippage_bps?: number;
    open_fee_bps?: number;
    close_fee_bps?: number;
    total_cost_bps?: number;
    max_leverage?: number | null;
    filled?: boolean;
    filled_usd?: number;
    executed?: boolean | string;
    market_status?: string;
    quote_stale?: boolean;
    timestamp?: number;
    symbol?: string;
    buy?: ExchangeResultSide;
    sell?: ExchangeResultSide;
    // Symmetric holding fees (Hyperliquid, Lighter, Aster, Extended)
    holding_fee_1h_pct?: number;
    holding_fee_24h_pct?: number;
    // Directional holding fees (Veranta, Ostium)
    holding_fee_1h_long_pct?: number;
    holding_fee_1h_short_pct?: number;
    holding_fee_24h_long_pct?: number;
    holding_fee_24h_short_pct?: number;
}

interface CompareAPIResponse {
    asset: string;
    symbol_key: string;
    order_size_usd: number;
    order_type: string;
    direction: string;
    winner?: string;
    winner_cost_bps?: number;
    hyperliquid?: ExchangeResult | null;
    lighter?: ExchangeResult | null;
    aster?: ExchangeResult | null;
    veranta?: ExchangeResult | null;
    avantis?: ExchangeResult | null;
    avantis_x?: ExchangeResult | null;
    extended?: ExchangeResult | null;
    edgex?: ExchangeResult | null;
    grvt?: ExchangeResult | null;
    variational?: ExchangeResult | null;
    variational_swap?: ExchangeResult | null;
    ondo?: ExchangeResult | null;
    pacifica?: ExchangeResult | null;
    risex?: ExchangeResult | null;
    txflow?: ExchangeResult | null;
    binance?: ExchangeResult | null;
    bybit?: ExchangeResult | null;
    bitget?: ExchangeResult | null;
}

/* ------------------------------------------------------------------ */
/*  Transform one exchange result into a Venue                        */
/* ------------------------------------------------------------------ */
// KRX-listed assets come back as numeric codes ("005930/KRW"); show the ticker instead
function displaySymbol(symbol: string | undefined, assetKey: string): string | undefined {
    return symbol?.replace(/^\d{6}(?=\/|$)/, assetKey);
}

function toVenue(
    exchangeKey: string,
    data: ExchangeResult,
    assetKey: string,
    hasInsufficientLiquidity: boolean = false,
    marketClosed: boolean = false
): Venue {
    const meta = EXCHANGE_META[exchangeKey] ?? {
        name: exchangeKey,
        logo: `/logos/${exchangeKey}.png`,
        venueType: "dex" as VenueType,
    };

    const openFee = data.open_fee_bps;
    const closeFee = data.close_fee_bps;

    return {
        id: exchangeKey,
        name: meta.name,
        logo: meta.logo,
        venueType: meta.venueType,
        maxLeverage: data.max_leverage ?? null,
        openingSpreadBps: 0, // spread is already inside opening/closing slippage
        openingSlippageBps: data.opening_slippage_bps ?? null,
        closingSlippageBps: data.closing_slippage_bps ?? null,
        feeBps:
            openFee == null || closeFee == null ? null : openFee + closeFee,
        updatedAt: data.timestamp
            ? new Date(data.timestamp * 1000).toISOString()
            : new Date().toISOString(),
        symbol: displaySymbol(data.symbol, assetKey),
        hasInsufficientLiquidity,
        marketClosed,
        availableLiquidityUsd: data.filled_usd,
        maxBuyUsd: data.buy?.filled_usd,
        maxSellUsd: data.sell?.filled_usd,
        fundingFee1hPct: data.holding_fee_1h_pct,
        fundingFee24hPct: data.holding_fee_24h_pct,
        fundingFee1hLongPct: data.holding_fee_1h_long_pct,
        fundingFee1hShortPct: data.holding_fee_1h_short_pct,
        fundingFee24hLongPct: data.holding_fee_24h_long_pct,
        fundingFee24hShortPct: data.holding_fee_24h_short_pct,
    };
}

function toAsset(raw: BackendAsset): Asset {
    const listedOther = Object.entries(raw.exchanges ?? {})
        .filter(([key, isListed]) => isListed && EXCHANGE_KEYS.includes(key) && !VERANTA_KEYS.has(key))
        .map(([key]) => key);
    const hasDex = listedOther.some((k) => !CEX_KEYS.has(k));
    const hasCex = listedOther.some((k) => CEX_KEYS.has(k));

    const known = ASSET_BY_ID.get(raw.key);
    if (known) {
        return { ...known, hasDex, hasCex };
    }

    const ticker = raw.symbol || raw.key;
    // Backend `name` is either a pair ("LLY/USD") or a display name ("Samsung Electronics (005930)")
    const nameIsPair = !!raw.name && raw.name.includes("/");

    const displayName = raw.name?.replace(/\s*\(\d+\)\s*$/, "");

    return {
        id: raw.key,
        symbol: nameIsPair ? raw.name! : `${ticker}/USD`,
        name: !nameIsPair && displayName ? displayName : ticker,
        category: categorizeAsset(raw.key),
        hasDex,
        hasCex,
    };
}

function isListedOnVeranta(exchanges: BackendAsset["exchanges"]): boolean {
    return Object.entries(exchanges ?? {}).some(
        ([key, isListed]) => Boolean(isListed) && VERANTA_KEYS.has(key)
    );
}

function isComparableAsset(exchanges: BackendAsset["exchanges"]): boolean {
    // This dashboard is Veranta-only: skip anything the venue does not list
    if (!isListedOnVeranta(exchanges)) return false;

    const listed = Object.entries(exchanges ?? {})
        .filter(([key, isListed]) => isListed && EXCHANGE_KEYS.includes(key))
        .map(([key]) => key);
    const otherVenues = listed.filter((key) => !VERANTA_KEYS.has(key));
    // Need at least one non-Veranta venue so there is something to compare
    return otherVenues.length >= 1;
}

/* ------------------------------------------------------------------ */
/*  Public: fetch comparable assets from Python API                   */
/* ------------------------------------------------------------------ */
export async function fetchAssets(signal?: AbortSignal): Promise<Asset[]> {
    const res = await fetch(`${API_BASE}/api/assets`, { cache: "no-store", signal });

    if (!res.ok) {
        throw new Error(`API error ${res.status}: ${await res.text()}`);
    }

    const json: AssetsAPIResponse = await res.json();

    return (json.assets ?? [])
        .filter((asset) => isComparableAsset(asset.exchanges))
        .map(toAsset);
}

/* ------------------------------------------------------------------ */
/*  Public: fetch comparison from Python API                          */
/* ------------------------------------------------------------------ */
export async function fetchComparison(
    assetKey: string,
    orderSize: number,
    direction: "long" | "short",
    orderType: string = "taker",
    signal?: AbortSignal
): Promise<Venue[]> {
    const params = new URLSearchParams({
        size: String(orderSize),
        order_type: orderType,
        direction,
    });
    const endpoint = `${API_BASE}/api/compare/${encodeURIComponent(assetKey)}?${params.toString()}`;

    const res = await fetch(endpoint, { cache: "no-store", signal });

    if (!res.ok) {
        throw new Error(`API error ${res.status}: ${await res.text()}`);
    }

    const json: CompareAPIResponse = await res.json();

    // Convert each exchange that returned data into a Venue
    const venues: Venue[] = [];

    for (const key of EXCHANGE_KEYS) {
        let exData = json[key as keyof CompareAPIResponse] as
            | ExchangeResult
            | null
            | undefined;

        // Legacy API keys: Avantis / Avantis X were renamed to Veranta
        if (key === "veranta" && !(exData && typeof exData === "object")) {
            exData = json.avantis ?? json.avantis_x;
        }

        if (exData && typeof exData === "object") {
            const marketClosed =
                exData.market_status === "closed" || exData.quote_stale === true;
            const hasInsufficientLiquidity =
                !marketClosed &&
                (exData.filled === false ||
                    exData.executed === false ||
                    exData.executed === "false" ||
                    exData.executed === "PARTIAL");

            venues.push(
                toVenue(
                    key,
                    exData,
                    json.symbol_key || assetKey,
                    hasInsufficientLiquidity,
                    marketClosed
                )
            );
        }
    }

    return venues;
}
