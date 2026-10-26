import { NextResponse } from "next/server";
import { ASSETS } from "@/lib/server/models";
import { VariationalAPI } from "@/lib/server/exchanges/variational";
import { VariationalSwapAPI } from "@/lib/server/exchanges/variational_swap";
import { BinanceAPI } from "@/lib/server/exchanges/binance";
import { BybitAPI } from "@/lib/server/exchanges/bybit";
import { BitgetAPI } from "@/lib/server/exchanges/bitget";
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

    const keyUp = key.toUpperCase();
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
        extended: Boolean(config.extended_symbol),
        edgex: Boolean(config.edgex_contract_id),
        grvt: Boolean(config.grvt_instrument),
        variational: keyUp in VariationalAPI.VARIATIONAL_SYMBOLS,
        variational_swap: keyUp in VariationalSwapAPI.VARIATIONAL_SWAP_SYMBOLS,
        ondo: Boolean(config.ondo_symbol),
        pacifica: Boolean(config.pacifica_symbol),
        risex: Boolean(config.risex_market_id),
        txflow: Boolean(config.txflow_symbol),
        binance: keyUp in BinanceAPI.SYMBOLS,
        bybit: keyUp in BybitAPI.SYMBOLS,
        bitget: keyUp in BitgetAPI.SYMBOLS,
      },
    });
  }

  return NextResponse.json({ assets: assetsList });
}
