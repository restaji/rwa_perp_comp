import { NextResponse } from "next/server";
import { ASSETS } from "@/lib/server/models";
import { VariationalAPI } from "@/lib/server/exchanges/variational";

export const dynamic = "force-dynamic";

export async function GET() {
  const assetsList = Object.entries(ASSETS).map(([key, config]) => ({
    key,
    name: config.name,
    symbol: config.symbol_key,
    exchanges: {
      hyperliquid: config.hyperliquid_symbol !== null,
      lighter: config.lighter_market_id !== null,
      aster: config.aster_symbol !== null,
      avantis: true,
      ostium: config.ostium_symbol !== null,
      extended: Boolean(config.extended_symbol),
      edgex: Boolean(config.edgex_contract_id),
      grvt: Boolean(config.grvt_instrument),
      variational: key.toUpperCase() in VariationalAPI.VARIATIONAL_SYMBOLS,
      ondo: Boolean(config.ondo_symbol),
      pacifica: Boolean(config.pacifica_symbol),
    },
  }));

  return NextResponse.json({ assets: assetsList });
}
