import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center font-medium transition-colors",
  {
    variants: {
      variant: {
        // Primary lime pill - for CTAs, winners, selected
        default:
          "px-3 py-1 rounded-full bg-[#D8F213] text-[#0A0A0A] text-xs font-semibold",
        // Winner badge
        winner:
          "px-3 py-1 rounded-full bg-[#D8F213] text-[#0A0A0A] text-xs font-semibold",
        // Outline pill - for labels, tags
        outline:
          "px-3 py-1 rounded-full border border-white/15 text-[#888] text-xs",
        // Muted - leverage badges etc
        muted:
          "px-2 py-0.5 rounded-full bg-white/5 text-[#888] text-[10px] border border-white/10",
        // Secondary dark
        secondary:
          "px-3 py-1 rounded-full bg-[#2A2A2A] text-[#999] text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
