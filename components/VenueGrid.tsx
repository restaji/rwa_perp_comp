"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Info,
  LayoutGrid,
  List,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VenueCard, VenueCardSkeleton } from "@/components/VenueCard";
import { Venue } from "@/lib/mockVenues";
import {
  calculateUsdCost,
  formatBps,
  formatUsd,
  formatLiquidityFull,
  calculateTotalCostBps,
  formatCostValue,
  costUnitSuffix,
  cn,
} from "@/lib/utils";

export type CostUnit = "bps" | "pct";

type SortField = "totalCost" | "fees" | "slippage";
type SortDirection = "asc" | "desc";
type ViewMode = "cards" | "table";


interface VenueGridProps {
  venues: Venue[];
  orderSize: number;
  isLoading: boolean;
  winnerVenueId: string | null;
  direction: "long" | "short";
  costUnit: CostUnit;
  onCostUnitChange: (unit: CostUnit) => void;
}

export function VenueGrid({
  venues,
  orderSize,
  isLoading,
  winnerVenueId,
  direction,
  costUnit,
  onCostUnitChange,
}: VenueGridProps) {
  const [sortField, setSortField] = useState<SortField>("totalCost");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const sortedVenues = useMemo(() => {
    const sorted = [...venues].sort((a, b) => {
      // Always put insufficient liquidity venues at the bottom
      if (a.hasInsufficientLiquidity && !b.hasInsufficientLiquidity) return 1;
      if (!a.hasInsufficientLiquidity && b.hasInsufficientLiquidity) return -1;

      let aValue: number;
      let bValue: number;

      switch (sortField) {
        case "totalCost":
          aValue = calculateTotalCostBps(a);
          bValue = calculateTotalCostBps(b);
          break;
        case "fees":
          aValue = a.feeBps;
          bValue = b.feeBps;
          break;
        case "slippage":
          aValue = a.openingSlippageBps + a.closingSlippageBps;
          bValue = b.openingSlippageBps + b.closingSlippageBps;
          break;
        default:
          return 0;
      }

      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    });

    return sorted;
  }, [venues, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({
    field,
    isActive,
  }: {
    field: SortField;
    isActive: boolean;
  }) => {
    const iconClass = isActive
      ? "w-3.5 h-3.5 text-[#0A0A0A]"
      : "w-3.5 h-3.5 text-[#555]";

    if (sortField !== field) {
      return <ArrowUpDown className={iconClass} />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className={iconClass} />
    ) : (
      <ArrowDown className={iconClass} />
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-5">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-6 w-24 rounded skeleton-shimmer" />
            <div className="h-5 w-16 rounded skeleton-shimmer" />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-10 w-20 rounded-full skeleton-shimmer" />
            <div className="h-9 w-48 rounded-full skeleton-shimmer" />
          </div>
        </div>

        {/* Content skeleton based on view mode */}
        {viewMode === "table" ? (
          <div className="card-nebular overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3">
                    <div className="h-4 w-16 rounded skeleton-shimmer" />
                  </th>
                  <th className="text-left px-4 py-3">
                    <div className="h-4 w-14 rounded skeleton-shimmer" />
                  </th>
                  <th className="text-right px-4 py-3">
                    <div className="h-4 w-20 rounded skeleton-shimmer ml-auto" />
                  </th>
                  <th className="text-right px-4 py-3">
                    <div className="h-4 w-20 rounded skeleton-shimmer ml-auto" />
                  </th>
                  <th className="text-right px-4 py-3">
                    <div className="h-4 w-12 rounded skeleton-shimmer ml-auto" />
                  </th>
                  <th className="text-right px-4 py-3">
                    <div className="h-4 w-20 rounded skeleton-shimmer ml-auto" />
                  </th>
                  <th className="text-right px-4 py-3">
                    <div className="h-4 w-16 rounded skeleton-shimmer ml-auto" />
                  </th>
                  <th className="text-right px-4 py-3">
                    <div className="h-4 w-16 rounded skeleton-shimmer ml-auto" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg skeleton-shimmer" />
                        <div className="flex flex-col gap-1">
                          <div className="h-4 w-24 rounded skeleton-shimmer" />
                          <div className="h-3 w-16 rounded skeleton-shimmer" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-10 rounded skeleton-shimmer" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-14 rounded skeleton-shimmer ml-auto" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-14 rounded skeleton-shimmer ml-auto" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-12 rounded skeleton-shimmer ml-auto" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-18 rounded skeleton-shimmer ml-auto" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-16 rounded skeleton-shimmer ml-auto" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-14 rounded skeleton-shimmer ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(6)].map((_, i) => (
              <VenueCardSkeleton key={i} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header with sorting and view toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">All Venues</h3>
          <span className="text-sm text-[#666]">{venues.length} results</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-[#555] cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="bg-[#1A1A1A] border-white/10 rounded-xl">
                <p className="text-xs max-w-[200px]">
                  <strong>bps</strong> = basis points. 1 bps = 0.01%
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-4">
          {/* View toggle */}
          <div className="flex items-center bg-white/5 rounded-full p-1">
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "p-2 rounded-full transition-all",
                viewMode === "table"
                  ? "bg-white/10 text-white"
                  : "text-[#666] hover:text-white",
              )}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={cn(
                "p-2 rounded-full transition-all",
                viewMode === "cards"
                  ? "bg-white/10 text-white"
                  : "text-[#666] hover:text-white",
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Unit toggle */}
          <div className="flex items-center bg-white/5 rounded-full p-1">
            <button
              onClick={() => onCostUnitChange("bps")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full transition-all",
                costUnit === "bps"
                  ? "bg-white/10 text-white"
                  : "text-[#666] hover:text-white"
              )}
            >
              bps
            </button>
            <button
              onClick={() => onCostUnitChange("pct")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full transition-all",
                costUnit === "pct"
                  ? "bg-white/10 text-white"
                  : "text-[#666] hover:text-white"
              )}
            >
              %
            </button>
          </div>

          {/* Sort pills */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#666] uppercase tracking-wider mr-1">
              Sort:
            </span>
            <div className="flex gap-1.5">
              {[
                { field: "totalCost" as const, label: "Cost" },
                { field: "fees" as const, label: "Fees" },
                { field: "slippage" as const, label: "Slippage" },
              ].map(({ field, label }) => (
                <button
                  key={field}
                  onClick={() => handleSort(field)}
                  className={cn(
                    "h-9 px-4 text-xs rounded-full flex items-center gap-1.5 transition-all duration-200 font-medium",
                    sortField === field
                      ? "bg-[#D8F213] text-[#0A0A0A]"
                      : "bg-white/5 border border-white/10 text-[#999] hover:bg-white/10",
                  )}
                >
                  {label}
                  <SortIcon field={field} isActive={sortField === field} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Card View */}
      {viewMode === "cards" && (
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {sortedVenues.map((venue, index) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                orderSize={orderSize}
                isWinner={venue.id === winnerVenueId}
                index={index}
                direction={direction}
                costUnit={costUnit}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <TooltipProvider>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card-nebular overflow-hidden"
          >
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs text-[#666] font-medium uppercase tracking-wider px-4 py-3">
                    Platform
                  </th>
                  <th className="text-left text-xs text-[#666] font-medium uppercase tracking-wider px-4 py-3">
                    Max Leverage
                  </th>
                  <th className="text-right text-xs text-[#666] font-medium uppercase tracking-wider px-4 py-3">
                    Opening Spread
                  </th>
                  <th className="text-right text-xs text-[#666] font-medium uppercase tracking-wider px-4 py-3">
                    Closing Spread
                  </th>
                  <th className="text-right text-xs text-[#666] font-medium uppercase tracking-wider px-4 py-3">
                    Fees
                  </th>
                  <th className="text-right text-xs text-[#666] font-medium uppercase tracking-wider px-4 py-3">
                    Total Cost
                  </th>
                  <th className="text-right text-xs text-[#666] font-medium uppercase tracking-wider px-4 py-3">
                    USD Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedVenues.map((venue, index) => {
                  const totalCost = calculateTotalCostBps(venue);
                  const usdCost = calculateUsdCost(orderSize, totalCost);
                  const isWinner = venue.id === winnerVenueId;
                  const hasInsufficientLiquidity =
                    venue.hasInsufficientLiquidity;

                  return (
                    <motion.tr
                      key={venue.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={cn(
                        "border-b border-white/5 last:border-0 transition-colors hover:bg-white/[0.02]",
                        isWinner &&
                          !hasInsufficientLiquidity &&
                          "bg-[#D8F213]/[0.03] border-l-2 border-l-[#D8F213]",
                      )}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                            <Image
                              src={venue.logo}
                              alt={venue.name}
                              width={32}
                              height={32}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">
                                {venue.name}
                              </span>
                              {isWinner && !hasInsufficientLiquidity && (
                                <span className="text-[10px] bg-[#D8F213] text-[#0A0A0A] px-2 py-0.5 rounded-full font-semibold">
                                  BEST
                                </span>
                              )}
                              {hasInsufficientLiquidity && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-[10px] bg-white/10 text-white px-2 py-0.5 rounded-full cursor-help">
                                      Partial fill
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-[#1A1A1A] border-white/10 rounded-xl max-w-[240px]">
                                    <p className="text-xs">
                                      Insufficient liquidity to fill the full{" "}
                                      {formatLiquidityFull(orderSize)} order
                                      size
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            {venue.symbol && (
                              <span className="text-[11px] text-[#555] font-mono">
                                {venue.symbol}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td
                        className="px-4 py-4 tabular-nums text-[#888]"
                        style={{
                          fontFamily:
                            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
                        }}
                      >
                        {venue.maxLeverage}x
                      </td>
                      <td
                        className="px-4 py-4 text-right tabular-nums text-white"
                        style={{
                          fontFamily:
                            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
                        }}
                      >
                        {formatCostValue(venue.openingSlippageBps, costUnit)}{costUnitSuffix(costUnit)}
                      </td>
                      <td
                        className="px-4 py-4 text-right tabular-nums text-white"
                        style={{
                          fontFamily:
                            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
                        }}
                      >
                        {formatCostValue(venue.closingSlippageBps, costUnit)}{costUnitSuffix(costUnit)}
                      </td>
                      <td
                        className="px-4 py-4 text-right tabular-nums text-white"
                        style={{
                          fontFamily:
                            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
                        }}
                      >
                        {formatCostValue(venue.feeBps, costUnit)}{costUnitSuffix(costUnit)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span
                          className={cn(
                            "tabular-nums font-medium",
                            isWinner && !hasInsufficientLiquidity
                              ? "text-[#D8F213]"
                              : "text-white",
                          )}
                          style={{
                            fontFamily:
                              'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
                          }}
                        >
                          {formatCostValue(totalCost, costUnit)}{costUnitSuffix(costUnit)}
                        </span>
                      </td>
                      <td
                        className="px-4 py-4 text-right tabular-nums text-white"
                        style={{
                          fontFamily:
                            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
                        }}
                      >
                        {formatUsd(usdCost)}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>
        </TooltipProvider>
      )}
    </div>
  );
}
