/**
 * API client for RWA Fee Comparison Python backend.
 *
 * Calls the Flask API and transforms the response into the
 * Venue[] shape expected by the UI components.
 */

import { Asset, ASSETS, Venue, categorizeAsset } from "./mockVenues";

export const API_BASE = (
    process.env.NEXT_PUBLIC_API_URL || ""
).replace(/\/+$/, "");

const EXCHANGE_META: Record<string, { name: string; logo: string }> = {
    hyperliquid: { name: "Hyperliquid", logo: "/logos/hyperliquid.png" },
    lighter: { name: "Lighter", logo: "/logos/lighter.png" },
    aster: { name: "Aster", logo: "/logos/aster.jpg" },
    veranta: { name: "Veranta", logo: "/logos/veranta.png" },
    ostium: { name: "Ostium", logo: "/logos/ostium.webp" },
    extended: { name: "Extended", logo: "/logos/extended.png" },
    edgex: { name: "EdgeX", logo: "/logos/edgex.png" },
    grvt: { name: "GRVT", logo: "/logos/grvt.png" },
    variational: { name: "Variational", logo: "/logos/variational.png" },
    ondo: { name: "Ondo Perps", logo: "/logos/ondo.png" },
    pacifica: { name: "Pacifica", logo: "/logos/pacifica.png" },
};

const EXCHANGE_KEYS = Object.keys(EXCHANGE_META);
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
    ostium?: ExchangeResult | null;
    extended?: ExchangeResult | null;
    edgex?: ExchangeResult | null;
    grvt?: ExchangeResult | null;
    variational?: ExchangeResult | null;
    ondo?: ExchangeResult | null;
    pacifica?: ExchangeResult | null;
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
    hasInsufficientLiquidity: boolean = false
): Venue {
    const meta = EXCHANGE_META[exchangeKey] ?? {
        name: exchangeKey,
        logo: `/logos/${exchangeKey}.png`,
    };

    const openFee = data.open_fee_bps ?? 0;
    const closeFee = data.close_fee_bps ?? 0;

    return {
        id: exchangeKey,
        name: meta.name,
        logo: meta.logo,
        maxLeverage: data.max_leverage ?? 0,
        openingSpreadBps: 0, // Python API combines spread into slippage
        openingSlippageBps: data.opening_slippage_bps ?? 0,
        closingSlippageBps: data.closing_slippage_bps ?? 0,
        feeBps: openFee + closeFee,
        updatedAt: data.timestamp
            ? new Date(data.timestamp * 1000).toISOString()
            : new Date().toISOString(),
        symbol: displaySymbol(data.symbol, assetKey),
        hasInsufficientLiquidity,
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
    const known = ASSET_BY_ID.get(raw.key);
    if (known) return known;

    const ticker = raw.symbol || raw.key;
    // Backend `name` is either a pair ("LLY/USD") or a display name ("Samsung Electronics (005930)")
    const nameIsPair = !!raw.name && raw.name.includes("/");

    const displayName = raw.name?.replace(/\s*\(\d+\)\s*$/, "");

    return {
        id: raw.key,
        symbol: nameIsPair ? raw.name! : `${ticker}/USD`,
        name: !nameIsPair && displayName ? displayName : ticker,
        category: categorizeAsset(raw.key),
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
            const hasInsufficientLiquidity =
                exData.filled === false ||
                exData.executed === false ||
                exData.executed === "false" ||
                exData.executed === "PARTIAL";

            venues.push(toVenue(key, exData, json.symbol_key || assetKey, hasInsufficientLiquidity));
        }
    }

    return venues;
}
