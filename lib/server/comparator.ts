import { ASSETS, AssetConfig, floorLeverage } from "./models";
import { HyperliquidAPI } from "./exchanges/hyperliquid";
import { LighterAPI } from "./exchanges/lighter";
import { AsterAPI } from "./exchanges/aster";
import { VerantaAPI } from "./exchanges/veranta";
import { OstiumAPI } from "./exchanges/ostium";
import { ExtendedAPI } from "./exchanges/extended";
import { EdgeXAPI } from "./exchanges/edgex";
import { GRVTAPI } from "./exchanges/grvt";
import { VariationalAPI } from "./exchanges/variational";
import { OndoAPI } from "./exchanges/ondo";
import { PacificaAPI } from "./exchanges/pacifica";

function finite(val: unknown, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function round3(val: number): number {
  return Math.round(val * 1000) / 1000;
}

const ALL_VENUES = [
  "hyperliquid",
  "lighter",
  "aster",
  "avantis",
  "ostium",
  "extended",
  "edgex",
  "grvt",
  "variational",
  "ondo",
  "pacifica",
] as const;

const MAKER_SLIP_VENUES = [
  "hyperliquid",
  "lighter",
  "aster",
  "extended",
  "edgex",
  "grvt",
  "ondo",
  "pacifica",
] as const;

const DIRECTION_SLIP_VENUES = [
  "hyperliquid",
  "lighter",
  "aster",
  "ostium",
  "extended",
  "edgex",
  "grvt",
  "variational",
  "ondo",
  "pacifica",
] as const;

export class FeeComparator {
  public hyperliquid = new HyperliquidAPI();
  public lighter = new LighterAPI();
  public aster = new AsterAPI();
  public veranta = new VerantaAPI();
  public ostium = new OstiumAPI();
  public extended = new ExtendedAPI();
  public edgex = new EdgeXAPI();
  public grvt = new GRVTAPI();
  public variational = new VariationalAPI();
  public ondo = new OndoAPI();
  public pacifica = new PacificaAPI();

  private blankResult(
    config: AssetConfig,
    orderSizeUsd: number,
    orderType: string,
    direction: string,
    variationalSymbol: string | null
  ): Record<string, any> {
    return {
      asset: config.name,
      symbol_key: config.symbol_key,
      order_size_usd: orderSizeUsd,
      order_type: orderType,
      direction,
      hyperliquid: null,
      lighter: null,
      aster: null,
      avantis: null,
      ostium: null,
      extended: null,
      edgex: null,
      grvt: null,
      variational: null,
      ondo: null,
      pacifica: null,
      symbols: {
        hyperliquid: config.hyperliquid_symbol,
        lighter: config.lighter_market_id ? config.symbol_key : null,
        aster: config.aster_symbol,
        avantis:
          config.symbol_key in VerantaAPI.PAIRS ? config.symbol_key : null,
        ostium: config.ostium_symbol,
        extended: config.extended_symbol ?? null,
        edgex: config.edgex_contract_id
          ? config.edgex_symbol || config.symbol_key
          : null,
        grvt: config.grvt_instrument ?? null,
        variational: variationalSymbol,
        ondo: config.ondo_symbol ?? null,
        pacifica: config.pacifica_symbol ?? null,
      },
    };
  }

  private async fetchHyperliquid(
    config: AssetConfig,
    orderSizeUsd: number
  ): Promise<[string, any, any]> {
    if (!config.hyperliquid_symbol) return ["hyperliquid", null, null];
    try {
      const r = await this.hyperliquid.getOptimalExecution(
        config.hyperliquid_symbol,
        orderSizeUsd
      );
      const sym = r ? r.symbol || config.hyperliquid_symbol : null;
      return ["hyperliquid", r, sym];
    } catch {
      return ["hyperliquid", null, null];
    }
  }

  private async fetchLighter(
    config: AssetConfig,
    orderSizeUsd: number
  ): Promise<[string, any, any]> {
    if (!config.lighter_market_id) return ["lighter", null, null];
    try {
      const ob = await this.lighter.getOrderbook(config.lighter_market_id);
      const r = await this.lighter.calculateExecutionCost(
        ob,
        orderSizeUsd,
        config.lighter_market_id
      );
      const liveSym =
        this.lighter.marketCache[Number(config.lighter_market_id)]?.symbol ||
        null;
      if (r) r.symbol = liveSym || config.symbol_key;
      return ["lighter", r, liveSym];
    } catch {
      return ["lighter", null, null];
    }
  }

  private async fetchAster(
    config: AssetConfig,
    orderSizeUsd: number
  ): Promise<[string, any, any]> {
    if (!config.aster_symbol) return ["aster", null, null];
    try {
      const ob = await this.aster.getOrderbook(config.aster_symbol);
      const r = await this.aster.calculateExecutionCost(
        ob,
        orderSizeUsd,
        config.aster_symbol
      );
      if (r) r.symbol = config.aster_symbol;
      return ["aster", r, null];
    } catch {
      return ["aster", null, null];
    }
  }

  private async fetchVeranta(
    config: AssetConfig,
    assetKey: string,
    orderSizeUsd: number,
    isLong: boolean
  ): Promise<[string, any, any]> {
    if (!(assetKey.toUpperCase() in VerantaAPI.PAIRS)) {
      return ["avantis", null, null];
    }
    try {
      const r = await this.veranta.calculateCost(
        assetKey,
        orderSizeUsd,
        isLong
      );
      let sym = null;
      if (r) {
        r.symbol = r.symbol || config.symbol_key;
        sym = r.symbol;
      }
      return ["avantis", r, sym];
    } catch {
      return ["avantis", null, null];
    }
  }

  private async fetchOstium(
    config: AssetConfig,
    orderSizeUsd: number,
    isLong: boolean
  ): Promise<[string, any, any]> {
    if (!config.ostium_symbol) return ["ostium", null, null];
    try {
      const r = await this.ostium.calculateExecutionCost(
        config.ostium_symbol,
        orderSizeUsd,
        isLong
      );
      if (r) r.symbol = config.ostium_symbol;
      return ["ostium", r, null];
    } catch {
      return ["ostium", null, null];
    }
  }

  private async fetchExtended(
    config: AssetConfig,
    orderSizeUsd: number
  ): Promise<[string, any, any]> {
    if (!config.extended_symbol) return ["extended", null, null];
    try {
      const ob = await this.extended.getOrderbook(config.extended_symbol);
      const r = await this.extended.calculateExecutionCost(
        ob,
        orderSizeUsd,
        config.extended_symbol
      );
      if (r) {
        r.symbol = config.extended_display_symbol || config.extended_symbol;
      }
      return ["extended", r, null];
    } catch {
      return ["extended", null, null];
    }
  }

  private async fetchEdgex(
    config: AssetConfig,
    orderSizeUsd: number,
    direction: string
  ): Promise<[string, any, any]> {
    if (!config.edgex_contract_id) return ["edgex", null, null];
    try {
      const sym = config.edgex_symbol || config.symbol_key;
      const r = await this.edgex.calculateExecutionCost(
        config.edgex_contract_id,
        orderSizeUsd,
        direction,
        sym
      );
      return ["edgex", r, null];
    } catch {
      return ["edgex", null, null];
    }
  }

  private async fetchGrvt(
    config: AssetConfig,
    orderSizeUsd: number,
    direction: string
  ): Promise<[string, any, any]> {
    if (!config.grvt_instrument) {
      return [
        "grvt",
        null,
        {
          code: "not_configured_for_asset",
          message: "No grvt_instrument in asset registry.",
        },
      ];
    }
    try {
      const [r, dbg] = await this.grvt.calculateExecutionCost(
        config.grvt_instrument,
        orderSizeUsd,
        direction,
        config.grvt_instrument
      );
      return ["grvt", r, dbg];
    } catch {
      return ["grvt", null, null];
    }
  }

  private async fetchVariational(
    assetKey: string,
    orderSizeUsd: number,
    isLong: boolean
  ): Promise<[string, any, any]> {
    try {
      const r = await this.variational.calculateCost(
        assetKey,
        orderSizeUsd,
        isLong
      );
      return ["variational", r, null];
    } catch {
      return ["variational", null, null];
    }
  }

  private async fetchOndo(
    config: AssetConfig,
    orderSizeUsd: number
  ): Promise<[string, any, any]> {
    if (!config.ondo_symbol) return ["ondo", null, null];
    try {
      const ob = await this.ondo.getOrderbook(config.ondo_symbol);
      const r = await this.ondo.calculateExecutionCost(
        ob,
        orderSizeUsd,
        config.ondo_symbol
      );
      if (r) r.symbol = config.ondo_symbol;
      return ["ondo", r, null];
    } catch {
      return ["ondo", null, null];
    }
  }

  private async fetchPacifica(
    config: AssetConfig,
    orderSizeUsd: number
  ): Promise<[string, any, any]> {
    if (!config.pacifica_symbol) return ["pacifica", null, null];
    try {
      const r = await this.pacifica.getOptimalExecution(
        config.pacifica_symbol,
        orderSizeUsd
      );
      if (r) r.symbol = config.pacifica_symbol;
      return ["pacifica", r, null];
    } catch {
      return ["pacifica", null, null];
    }
  }

  private zeroMakerSlippage(result: Record<string, any>): void {
    for (const name of MAKER_SLIP_VENUES) {
      const exData = result[name];
      if (!exData) continue;
      exData.slippage_bps = 0;
      exData.buy_slippage_bps = 0;
      exData.sell_slippage_bps = 0;
      if (exData.buy) exData.buy.slippage_bps = 0;
      if (exData.sell) exData.sell.slippage_bps = 0;
    }
  }

  async compareAsset(
    assetKey: string,
    orderSizeUsd: number,
    orderType: string = "taker",
    direction: string = "long"
  ): Promise<Record<string, any> | null> {
    if (!(assetKey in ASSETS)) return null;
    const config = ASSETS[assetKey];
    const isLong = direction.toLowerCase() === "long";
    const result = this.blankResult(
      config,
      orderSizeUsd,
      orderType,
      direction,
      VariationalAPI.VARIATIONAL_SYMBOLS[assetKey.toUpperCase()] || null
    );

    const results = await Promise.all([
      this.fetchHyperliquid(config, orderSizeUsd),
      this.fetchLighter(config, orderSizeUsd),
      this.fetchAster(config, orderSizeUsd),
      this.fetchVeranta(config, assetKey, orderSizeUsd, isLong),
      this.fetchOstium(config, orderSizeUsd, isLong),
      this.fetchExtended(config, orderSizeUsd),
      this.fetchEdgex(config, orderSizeUsd, direction),
      this.fetchGrvt(config, orderSizeUsd, direction),
      this.fetchVariational(assetKey, orderSizeUsd, isLong),
      this.fetchOndo(config, orderSizeUsd),
      this.fetchPacifica(config, orderSizeUsd),
    ]);

    for (const [name, payload, extra] of results) {
      result[name] = payload;
      if (extra == null) continue;
      if (name === "grvt") {
        result.grvt_debug = extra;
      } else {
        result.symbols[name] = extra;
      }
    }

    if (orderType === "maker") {
      this.zeroMakerSlippage(result);
    }

    return result;
  }

  private async bookFeeStructure(
    config: AssetConfig,
    orderType: string
  ): Promise<Record<string, { open: number | null; close: number | null }>> {
    const [hl, lt, as, ex, ed, gr, on, pa] = await Promise.all([
      config.hyperliquid_symbol
        ? this.hyperliquid.getFees(config.hyperliquid_symbol)
        : Promise.resolve<[number | null, number | null]>([null, null]),
      config.lighter_market_id
        ? this.lighter.getFees(config.lighter_market_id)
        : Promise.resolve<[number | null, number | null]>([null, null]),
      config.aster_symbol
        ? this.aster.getFees(config.aster_symbol)
        : Promise.resolve<[number | null, number | null]>([null, null]),
      config.extended_symbol
        ? this.extended.getFees(config.extended_symbol)
        : Promise.resolve<[number | null, number | null]>([null, null]),
      config.edgex_contract_id
        ? this.edgex.getFees(config.edgex_contract_id)
        : Promise.resolve<[number | null, number | null]>([null, null]),
      config.grvt_instrument
        ? this.grvt.getFees(config.grvt_instrument)
        : Promise.resolve<[number | null, number | null]>([null, null]),
      config.ondo_symbol
        ? this.ondo.getFees(config.ondo_symbol)
        : Promise.resolve<[number | null, number | null]>([null, null]),
      config.pacifica_symbol
        ? this.pacifica.getFees()
        : Promise.resolve<[number | null, number | null]>([null, null]),
    ]);

    const pairs: Record<string, [number | null, number | null]> = {
      hyperliquid: hl,
      lighter: lt,
      aster: as,
      extended: ex,
      edgex: ed,
      grvt: gr,
      ondo: on,
      pacifica: pa,
    };

    const useMaker = orderType === "maker";
    const structure: Record<
      string,
      { open: number | null; close: number | null }
    > = {};
    for (const [name, [taker, maker]] of Object.entries(pairs)) {
      const fee = useMaker ? maker : taker;
      structure[name] = { open: fee, close: fee };
    }
    return structure;
  }

  async calculateTotalsAndWinner(
    result: Record<string, any>,
    assetKey: string,
    orderType: string = "taker",
    direction: string = "long"
  ): Promise<Record<string, any>> {
    if (!result || !(assetKey in ASSETS)) return result;

    const feeStructure = await this.bookFeeStructure(
      ASSETS[assetKey],
      orderType
    );

    if (result.ostium) {
      feeStructure.ostium = {
        open: result.ostium.fee_bps ?? null,
        close: 0,
      };
    }
    if (result.avantis) {
      feeStructure.avantis = {
        open: result.avantis.open_fee_bps ?? 0,
        close: result.avantis.close_fee_bps ?? 0,
      };
    }
    if (result.variational) {
      feeStructure.variational = {
        open: result.variational.open_fee_bps ?? 0,
        close: result.variational.close_fee_bps ?? 0,
      };
    }

    const isLong = direction === "long";
    for (const name of DIRECTION_SLIP_VENUES) {
      const exData = result[name];
      if (!exData) continue;
      const buySlip = round3(finite(exData.buy_slippage_bps));
      const sellSlip = round3(finite(exData.sell_slippage_bps));
      exData.opening_slippage_bps = isLong ? buySlip : sellSlip;
      exData.closing_slippage_bps = isLong ? sellSlip : buySlip;
      exData.slippage_type = "opening_closing";
    }

    const ranked: { name: string; total_cost: number; filled: boolean }[] = [];
    for (const name of ALL_VENUES) {
      const exData = result[name];
      if (!exData) continue;
      if (exData.max_leverage != null) {
        exData.max_leverage = floorLeverage(exData.max_leverage);
      }
      const fees = feeStructure[name] || { open: null, close: null };
      if (exData.slippage_bps === null || exData.slippage_bps === undefined) {
        exData.total_cost_bps = null;
        exData.exchange = name;
        exData.filled = false;
        continue;
      }
      const slippage = finite(exData.slippage_bps);
      const effectiveSpread = name === "avantis" ? slippage : 2 * slippage;
      const fOpen = fees.open;
      const fClose = fees.close;
      if (fOpen === null || fClose === null) continue;

      const totalCost = round3(effectiveSpread + fOpen + fClose);
      exData.effective_spread_bps = round3(effectiveSpread);
      exData.open_fee_bps = round3(fOpen);
      exData.close_fee_bps = round3(fClose);
      exData.total_cost_bps = totalCost;
      exData.exchange = name;

      if (exData.executed !== "PARTIAL") {
        ranked.push({
          name,
          total_cost: totalCost,
          filled: exData.filled ?? true,
        });
      }
    }

    if (ranked.length > 0) {
      const winner = ranked.reduce((best, cur) =>
        cur.total_cost < best.total_cost ? cur : best
      );
      result.winner = winner.name;
      result.winner_cost_bps = round3(winner.total_cost);
    }

    return result;
  }
}

const globalForComparator = globalThis as unknown as {
  feeComparator?: FeeComparator;
};

export const comparator =
  globalForComparator.feeComparator ||
  (globalForComparator.feeComparator = new FeeComparator());
