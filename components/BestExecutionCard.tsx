"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Venue } from "@/lib/mockVenues";
import { formatOptionalCost, calculateAdjustedTotalCostBps } from "@/lib/utils";
import { CostUnit } from "@/components/VenueGrid";

interface BestExecutionCardProps {
  venue: Venue;
  orderSize: number;
  direction: "long" | "short";
  costUnit: CostUnit;
}

export function BestExecutionCard({ venue, orderSize, direction, costUnit }: BestExecutionCardProps) {
  const totalCostBps = calculateAdjustedTotalCostBps(venue, direction);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="py-2"
    >
      <p className="text-lg text-white flex items-center flex-wrap gap-x-1">
        <span>Best platform to execute this trade is</span>
        <span className="w-5 h-5 rounded-md overflow-hidden flex-shrink-0">
          <Image
            src={venue.logo}
            alt={venue.name}
            width={20}
            height={20}
            className="w-full h-full object-cover"
          />
        </span>
        <span className="font-semibold">{venue.name}</span>
        <span>at</span>
        <span className="text-[#D8F213] font-semibold">{formatOptionalCost(totalCostBps, costUnit)}</span>
      </p>
    </motion.div>
  );
}

export function BestExecutionCardSkeleton() {
  return (
    <div className="py-2">
      <div className="flex items-center gap-2">
        <div className="h-5 w-64 rounded skeleton-shimmer" />
        <div className="w-5 h-5 rounded-md skeleton-shimmer" />
        <div className="h-5 w-20 rounded skeleton-shimmer" />
        <div className="h-5 w-16 rounded skeleton-shimmer" />
        <div className="h-5 w-16 rounded skeleton-shimmer" />
      </div>
    </div>
  );
}
