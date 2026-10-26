import { NextRequest, NextResponse } from "next/server";
import { ASSETS } from "@/lib/server/models";
import { comparator } from "@/lib/server/comparator";

export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";
export const maxDuration = 30;

const MAX_ORDER_SIZE = 1_000_000_000;
const MIN_ORDER_SIZE = 1;
const VALID_ORDER_TYPES = new Set(["taker", "maker"]);
const VALID_DIRECTIONS = new Set(["long", "short"]);

function validateOrderSize(raw: unknown): number | null {
  const val = Number(raw);
  if (!Number.isFinite(val)) return null;
  if (val < MIN_ORDER_SIZE || val > MAX_ORDER_SIZE) return null;
  return val;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { asset: string } }
) {
  const asset = (params.asset || "").toUpperCase();
  const searchParams = req.nextUrl.searchParams;
  const orderSize = validateOrderSize(searchParams.get("size") ?? 1_000_000);
  const orderType = (searchParams.get("order_type") ?? "taker").toLowerCase();
  const direction = (searchParams.get("direction") ?? "long").toLowerCase();

  if (orderSize === null) {
    return NextResponse.json(
      {
        error: `size must be a number between ${MIN_ORDER_SIZE} and ${MAX_ORDER_SIZE}`,
      },
      { status: 400 }
    );
  }
  if (!VALID_ORDER_TYPES.has(orderType)) {
    return NextResponse.json(
      { error: "order_type must be one of: taker, maker" },
      { status: 400 }
    );
  }
  if (!VALID_DIRECTIONS.has(direction)) {
    return NextResponse.json(
      { error: "direction must be one of: long, short" },
      { status: 400 }
    );
  }
  if (!(asset in ASSETS) || !(await comparator.veranta.isPairListed(asset))) {
    return NextResponse.json(
      {
        error: `Asset ${asset} not found or not listed on Veranta`,
        available_assets: Object.keys(ASSETS),
      },
      { status: 400 }
    );
  }

  const rawResult = await comparator.compareAsset(
    asset,
    orderSize,
    orderType,
    direction
  );
  if (!rawResult) {
    return NextResponse.json(
      { error: "Failed to compare asset" },
      { status: 500 }
    );
  }

  const result = await comparator.calculateTotalsAndWinner(
    rawResult,
    asset,
    orderType,
    direction
  );
  return NextResponse.json(result);
}
