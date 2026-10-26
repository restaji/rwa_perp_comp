import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBps(bps: number): string {
  return bps.toFixed(2);
}

export function formatPercent(bps: number): string {
  return (bps / 100).toFixed(4);
}

export function formatCostValue(bps: number, unit: "bps" | "pct"): string {
  return unit === "bps" ? formatBps(bps) : formatPercent(bps);
}

export function costUnitSuffix(unit: "bps" | "pct"): string {
  return unit === "bps" ? " bps" : "%";
}

export function formatUsd(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(2)}K`;
  }
  return `$${amount.toFixed(2)}`;
}

export function parseOrderSize(input: string): number | null {
  const cleaned = input.toLowerCase().replace(/[,$\s]/g, "");
  
  const multipliers: Record<string, number> = {
    k: 1000,
    m: 1000000,
    b: 1000000000,
  };
  
  const match = cleaned.match(/^(\d+(?:\.\d+)?)(k|m|b)?$/);
  if (!match) return null;
  
  const value = parseFloat(match[1]);
  const multiplier = match[2] ? multipliers[match[2]] : 1;
  
  return value * multiplier;
}

export function calculateTotalCostBps(venue: {
  openingSpreadBps: number;
  openingSlippageBps: number;
  closingSlippageBps: number;
  feeBps: number;
}): number {
  return (
    venue.openingSpreadBps +
    venue.openingSlippageBps +
    venue.closingSlippageBps +
    venue.feeBps
  );
}

export function calculateUsdCost(orderSize: number, totalCostBps: number): number {
  return (orderSize * totalCostBps) / 10000;
}

export function formatLiquidityCompact(amount: number | undefined): string {
  if (amount === undefined || amount === null) return "N/A";
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${Math.round(amount)}`;
}

export function formatLiquidityFull(amount: number | undefined): string {
  if (amount === undefined || amount === null) return "N/A";
  return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/**
 * Format a holding fee (receives the raw percentage value).
 * Positive = position pays this rate (cost), Negative = position receives it (benefit).
 */
export function formatHoldingFeeBps(pct: number | undefined, unit: "bps" | "pct" = "bps"): string {
  if (pct === undefined || pct === null) return "—";
  const bpsValue = pct * 100;
  return `${formatCostValue(bpsValue, unit)}${costUnitSuffix(unit)}`;
}

/**
 * Returns the holding fee as a cost % for the selected direction.
 *
 * - For directional exchanges (Veranta, Ostium): use the direction-specific rate
 *   directly (positive = that side pays, negative = that side receives).
 * - For symmetric exchanges (HL, Lighter, Aster, Extended): the raw rate is
 *   expressed from the long perspective (positive = longs pay, shorts receive),
 *   so it is negated for the short side.
 *
 * Positive result → adds to total cost. Negative result → reduces total cost.
 */
export function getHoldingFeeDisplayPct(
  venue: {
    fundingFee24hPct?: number;
    fundingFee24hLongPct?: number;
    fundingFee24hShortPct?: number;
  },
  direction: "long" | "short"
): number | undefined {
  if (direction === "long") {
    if (venue.fundingFee24hLongPct !== undefined) return venue.fundingFee24hLongPct;
    return venue.fundingFee24hPct;
  } else {
    if (venue.fundingFee24hShortPct !== undefined) return venue.fundingFee24hShortPct;
    if (venue.fundingFee24hPct !== undefined) return -venue.fundingFee24hPct;
    return undefined;
  }
}

/**
 * Returns the holding fee adjustment in bps (1% = 100 bps).
 * Positive = adds to total cost, Negative = reduces total cost.
 */
export function getHoldingFeeCostBps(
  venue: {
    fundingFee24hPct?: number;
    fundingFee24hLongPct?: number;
    fundingFee24hShortPct?: number;
  },
  direction: "long" | "short"
): number {
  const pct = getHoldingFeeDisplayPct(venue, direction);
  if (pct === undefined) return 0;
  return pct * 100;
}

/**
 * Total cost including the 24H holding fee adjustment for the given direction.
 */
export function calculateAdjustedTotalCostBps(
  venue: {
    openingSpreadBps: number;
    openingSlippageBps: number;
    closingSlippageBps: number;
    feeBps: number;
    fundingFee24hPct?: number;
    fundingFee24hLongPct?: number;
    fundingFee24hShortPct?: number;
  },
  direction: "long" | "short"
): number {
  return calculateTotalCostBps(venue) + getHoldingFeeCostBps(venue, direction);
}
