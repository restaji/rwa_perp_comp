"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Search } from "lucide-react";
import { ORDER_SIZES, Asset, AssetCategory } from "@/lib/mockVenues";
import { cn } from "@/lib/utils";

type CategoryTab = { id: AssetCategory | "All"; label: string };

const CATEGORY_TABS: CategoryTab[] = [
  { id: "All", label: "All" },
  { id: "Equities", label: "Equities" },
  { id: "Indices", label: "Indices" },
  { id: "Commodities", label: "Commodities" },
  { id: "Forex", label: "Forex" },
];

interface FiltersPanelProps {
  assets: Asset[];
  selectedAsset: string;
  setSelectedAsset: (asset: string) => void;
  direction: "long" | "short";
  setDirection: (direction: "long" | "short") => void;
  orderSize: number;
  setOrderSize: (size: number) => void;
  customSize: string;
  setCustomSize: (size: string) => void;
}

export function FiltersPanel({
  assets,
  selectedAsset,
  setSelectedAsset,
  direction,
  setDirection,
  orderSize,
  setOrderSize,
  customSize,
  setCustomSize,
}: FiltersPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<AssetCategory | "All">("All");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
        setActiveCategory("All");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSizeClick = (size: number) => {
    setOrderSize(size);
    setCustomSize("");
  };

  const handleCustomSizeChange = (value: string) => {
    setCustomSize(value);
    const parsed = parseCustomSize(value);
    if (parsed) {
      setOrderSize(parsed);
    }
  };

  const parseCustomSize = (input: string): number | null => {
    const cleaned = input.toLowerCase().replace(/[,$\s]/g, "");
    const multipliers: Record<string, number> = { k: 1000, m: 1000000, b: 1000000000 };
    const match = cleaned.match(/^(\d+(?:\.\d+)?)(k|m|b)?$/);
    if (!match) return null;
    const value = parseFloat(match[1]);
    const multiplier = match[2] ? multipliers[match[2]] : 1;
    return value * multiplier;
  };

  const currentAsset = assets.find((a) => a.id === selectedAsset);
  let pairLabel = "Select";
  if (currentAsset?.symbol) {
    pairLabel = currentAsset.symbol;
  } else if (assets.length === 0) {
    pairLabel = "Loading…";
  }
  const filteredAssets = assets.filter((a) => {
    const q = search.toLowerCase();
    const matchesSearch =
      a.id.toLowerCase().includes(q) ||
      a.symbol.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q);
    const matchesCategory = activeCategory === "All" || a.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const CATEGORIES = CATEGORY_TABS.filter(
    (category) =>
      category.id === "All" || assets.some((asset) => asset.category === category.id)
  );

  const isCustomActive = customSize !== "" && ORDER_SIZES.every((s) => s.value !== orderSize);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Pair */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen((open) => !open)}
            disabled={assets.length === 0}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            <span className="text-2xl font-semibold text-white">
              {pairLabel}
            </span>
            <ChevronDown className={cn("w-5 h-5 text-[#666] transition-transform", isOpen && "rotate-180")} />
          </button>

          {isOpen && (
            <div className="absolute top-full left-0 mt-2 w-96 bg-[#1A1A1A]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2 z-50 shadow-xl">
              {/* Category tabs */}
              <div className="flex gap-1 mb-2 p-1 bg-white/[0.03] rounded-xl">
                {CATEGORIES.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setActiveCategory(id)}
                    className={cn(
                      "flex-1 px-1.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-150",
                      activeCategory === id
                        ? "bg-[#D8F213] text-[#0A0A0A]"
                        : "text-[#666] hover:text-white"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
                <input
                  type="text"
                  placeholder="Search pairs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white/5 border-0 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-[#666] focus:outline-none focus:ring-1 focus:ring-[#D8F213]/50"
                  autoFocus
                />
              </div>

              {/* Asset list */}
              <div className="max-h-80 overflow-y-auto">
                {filteredAssets.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-[#666] text-center">No pairs found</div>
                ) : (
                  filteredAssets.map((asset) => (
                    <button
                      key={asset.id}
                      onClick={() => {
                        setSelectedAsset(asset.id);
                        setIsOpen(false);
                        setSearch("");
                        setActiveCategory("All");
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left",
                        asset.id === selectedAsset
                          ? "bg-[#D8F213]/10 text-white"
                          : "hover:bg-white/5 text-[#999]"
                      )}
                    >
                      <span className="font-mono font-semibold text-white">{asset.symbol}</span>
                      <span className="text-[#666] text-sm">{asset.name}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Direction */}
        <div className="flex items-center bg-white/5 rounded-full p-1">
          <button
            onClick={() => setDirection("long")}
            className={cn(
              "px-5 py-2 text-sm font-medium rounded-full transition-all duration-200",
              direction === "long"
                ? "bg-[#D8F213] text-[#0A0A0A]"
                : "text-[#666] hover:text-white"
            )}
          >
            Long
          </button>
          <button
            onClick={() => setDirection("short")}
            className={cn(
              "px-5 py-2 text-sm font-medium rounded-full transition-all duration-200",
              direction === "short"
                ? "bg-[#EF4444] text-white"
                : "text-[#666] hover:text-white"
            )}
          >
            Short
          </button>
        </div>
      </div>

      {/* Order Size */}
      <div className="space-y-2">
        <span className="text-sm text-[#666]">Position size</span>
        <div className="flex flex-wrap items-center gap-2">
          {ORDER_SIZES.map((size) => (
            <button
              key={size.value}
              onClick={() => handleSizeClick(size.value)}
              className={cn(
                "px-4 py-2 text-sm font-mono rounded-full transition-all duration-200",
                orderSize === size.value && !customSize
                  ? "bg-[#D8F213] text-[#0A0A0A]"
                  : "bg-white/5 text-[#888] hover:text-white hover:bg-white/10"
              )}
            >
              {size.label}
            </button>
          ))}
          <input
            type="text"
            placeholder="Custom"
            value={customSize}
            onChange={(e) => handleCustomSizeChange(e.target.value)}
            className={cn(
              "w-24 px-4 py-2 text-sm font-mono rounded-full transition-all duration-200 bg-white/5 border-0 placeholder:text-[#555] focus:outline-none focus:ring-1 focus:ring-[#D8F213]/50",
              isCustomActive ? "text-[#D8F213] ring-1 ring-[#D8F213]/50" : "text-white"
            )}
          />
        </div>
      </div>
    </motion.div>
  );
}
