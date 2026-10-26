import { NextResponse } from "next/server";
import { ASSETS } from "@/lib/server/models";
import { VariationalAPI } from "@/lib/server/exchanges/variational";
import { comparator } from "@/lib/server/comparator";

export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET() {
  await comparator.veranta.fetchSocketData();

  const assetsList = [];
  for (const [key, config] of Object.entries(ASSETS)) {
    const isOnVeranta = await comparator.veranta.isPairListed(key);
    // Anchor on Veranta: skip any asset not listed on Veranta
    if (!isOnVeranta) continue;

    assetsList.push({
      key,
      name: config.name,
      symbol: config.symbol_key,
      exchanges: {
        hyperliquid: config.hyperliquid_symbol !== null,
        lighter: config.lighter_market_id !== null,
        aster: config.aster_symbol !== null,
        avantis: true,
        veranta: true,
        ostium: config.ostium_symbol !== null,
        extended: Boolean(config.extended_symbol),
        edgex: Boolean(config.edgex_contract_id),
        grvt: Boolean(config.grvt_instrument),
        variational: key.toUpperCase() in VariationalAPI.VARIATIONAL_SYMBOLS,
        ondo: Boolean(config.ondo_symbol),
        pacifica: Boolean(config.pacifica_symbol),
      },
    });
  }

  return NextResponse.json({ assets: assetsList });
}
