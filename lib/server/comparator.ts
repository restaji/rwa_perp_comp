import { ASSETS, AssetConfig, floorLeverage } from "./models";
import { HyperliquidAPI } from "./exchanges/hyperliquid";
import { LighterAPI } from "./exchanges/lighter";
import { AsterAPI } from "./exchanges/aster";
import { VerantaAPI } from "./exchanges/veranta";
import { ExtendedAPI } from "./exchanges/extended";
import { EdgeXAPI } from "./exchanges/edgex";
import { GRVTAPI } from "./exchanges/grvt";
import { VariationalAPI } from "./exchanges/variational";
import { VariationalSwapAPI } from "./exchanges/variational_swap";
import { OndoAPI } from "./exchanges/ondo";
import { PacificaAPI } from "./exchanges/pacifica";
import { RISExAPI } from "./exchanges/risex";
import { TxFlowAPI } from "./exchanges/txflow";
import { BinanceAPI } from "./exchanges/binance";
import { BybitAPI } from "./exchanges/bybit";
import { BitgetAPI } from "./exchanges/bitget";

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
  "extended",
  "edgex",
  "grvt",
  "variational",
  "variational_swap",
  "ondo",
  "pacifica",
  "risex",
  "txflow",
  "binance",
  "bybit",
  "bitget",
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
  "risex",
  "txflow",
  "binance",
  "bybit",
  "bitget",
] as const;

const DIRECTION_SLIP_VENUES = [
  "hyperliquid",
  "lighter",
  "aster",
  "extended",
  "edgex",
  "grvt",
  "variational",
  "variational_swap",
  "ondo",
  "pacifica",
  "risex",
  "txflow",
  "binance",
  "bybit",
  "bitget",
] as const;

export class FeeComparator {
  public hyperliquid = new HyperliquidAPI();
  public lighter = new LighterAPI();
  public aster = new AsterAPI();
  public veranta = new VerantaAPI();
  public extended = new ExtendedAPI();
  public edgex = new EdgeXAPI();
  public grvt = new GRVTAPI();
  public variational = new VariationalAPI();
  public variationalSwap = new VariationalSwapAPI(this.variational);
  public ondo = new OndoAPI();
  public pacifica = new PacificaAPI();
  public risex = new RISExAPI();
  public txflow = new TxFlowAPI();
  public binance = new BinanceAPI();
  public bybit = new BybitAPI();
  public bitget = new BitgetAPI();

  private blankResult(
    config: AssetConfig,
    orderSizeUsd: number,
    orderType: string,
    direction: string,
    variationalSymbol: string | null,
    variationalSwapSymbol: string | null
  ): Record<string, any> {
    const keyUp = config.symbol_key.toUpperCase();
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
      extended: null,
      edgex: null,
      grvt: null,
      variational: null,
      variational_swap: null,
      ondo: null,
      pacifica: null,
      risex: null,
      txflow: null,
      binance: null,
      bybit: null,
      bitget: null,
      symbols: {
        hyperliquid: config.hyperliquid_symbol,
        lighter: config.lighter_market_id ? config.symbol_key : null,
        aster: config.aster_symbol,
        avantis:
          config.symbol_key in VerantaAPI.PAIRS ? config.symbol_key : null,
        extended: config.extended_symbol ?? null,
        edgex: config.edgex_contract_id
          ? config.edgex_symbol || config.symbol_key
          : null,
        grvt: config.grvt_instrument ?? null,
        variational: variationalSymbol,
        variational_swap: variationalSwapSymbol,
        ondo: config.ondo_symbol ?? null,
        pacifica: config.pacifica_symbol ?? null,
        risex: config.risex_market_id ? config.symbol_key : null,
        txflow: config.txflow_symbol ?? null,
        binance: BinanceAPI.SYMBOLS[keyUp] ?? null,
        bybit: BybitAPI.SYMBOLS[keyUp] ?? null,
        bitget: BitgetAPI.SYMBOLS[keyUp] ?? null,
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
      const [ob] = await Promise.all([
        this.lighter.getOrderbook(config.lighter_market_id),
        this.lighter.loadMarketCache(),
      ]);
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
      const [ob] = await Promise.all([
        this.aster.getOrderbook(config.aster_symbol),
        this.aster.getFees(config.aster_symbol),
        this.aster.getMaxLeverage(config.aster_symbol),
      ]);
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

  private async fetchExtended(
    config: AssetConfig,
    orderSizeUsd: number
  ): Promise<[string, any, any]> {
    if (!config.extended_symbol) return ["extended", null, null];
    try {
      const [ob] = await Promise.all([
        this.extended.getOrderbook(config.extended_symbol),
        this.extended.getFees(config.extended_symbol),
        this.extended.getMaxLeverage(config.extended_symbol),
      ]);
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
    if (!(assetKey.toUpperCase() in VariationalAPI.VARIATIONAL_INSTRUMENTS)) {
      return ["variational", null, null];
    }
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

  private async fetchVariationalSwap(
    assetKey: string,
    orderSizeUsd: number,
    isLong: boolean
  ): Promise<[string, any, any]> {
    if (
      !(assetKey.toUpperCase() in VariationalSwapAPI.VARIATIONAL_SWAP_INSTRUMENTS)
    ) {
      return ["variational_swap", null, null];
    }
    try {
      const r = await this.variationalSwap.calculateCost(
        assetKey,
        orderSizeUsd,
        isLong
      );
      return ["variational_swap", r, null];
    } catch {
      return ["variational_swap", null, null];
    }
  }

  private async fetchOndo(
    config: AssetConfig,
    orderSizeUsd: number
  ): Promise<[string, any, any]> {
    if (!config.ondo_symbol) return ["ondo", null, null];
    try {
      const [ob] = await Promise.all([
        this.ondo.getOrderbook(config.ondo_symbol),
        this.ondo.getFees(config.ondo_symbol),
        this.ondo.getMaxLeverage(config.ondo_symbol),
      ]);
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

  private async fetchRisex(
    config: AssetConfig,
    orderSizeUsd: number
  ): Promise<[string, any, any]> {
    if (!config.risex_market_id) return ["risex", null, null];
    try {
      const r = await this.risex.getOptimalExecution(
        config.risex_market_id,
        orderSizeUsd
      );
      const liveSym =
        this.risex.marketCache[Number(config.risex_market_id)]?.symbol || null;
      if (r) r.symbol = liveSym || config.symbol_key;
      return ["risex", r, liveSym];
    } catch {
      return ["risex", null, null];
    }
  }

  private async fetchTxflow(
    config: AssetConfig,
    orderSizeUsd: number
  ): Promise<[string, any, any]> {
    if (!config.txflow_symbol) return ["txflow", null, null];
    try {
      const r = await this.txflow.getOptimalExecution(
        config.txflow_symbol,
        orderSizeUsd
      );
      if (r) r.symbol = r.symbol || config.txflow_symbol;
      return ["txflow", r, null];
    } catch {
      return ["txflow", null, null];
    }
  }

  private async fetchBinance(
    assetKey: string,
    orderSizeUsd: number
  ): Promise<[string, any, any]> {
    const sym = BinanceAPI.SYMBOLS[assetKey.toUpperCase()];
    if (!sym) return ["binance", null, null];
    try {
      const r = await this.binance.getOptimalExecution(sym, orderSizeUsd);
      if (r) r.symbol = r.symbol || sym;
      return ["binance", r, null];
    } catch {
      return ["binance", null, null];
    }
  }

  private async fetchBybit(
    assetKey: string,
    orderSizeUsd: number
  ): Promise<[string, any, any]> {
    const sym = BybitAPI.SYMBOLS[assetKey.toUpperCase()];
    if (!sym) return ["bybit", null, null];
    try {
      const r = await this.bybit.getOptimalExecution(sym, orderSizeUsd);
      if (r) r.symbol = r.symbol || sym;
      return ["bybit", r, null];
    } catch {
      return ["bybit", null, null];
    }
  }

  private async fetchBitget(
    assetKey: string,
    orderSizeUsd: number
  ): Promise<[string, any, any]> {
    const sym = BitgetAPI.SYMBOLS[assetKey.toUpperCase()];
    if (!sym) return ["bitget", null, null];
    try {
      const r = await this.bitget.getOptimalExecution(sym, orderSizeUsd);
      if (r) r.symbol = r.symbol || sym;
      return ["bitget", r, null];
    } catch {
      return ["bitget", null, null];
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
      VariationalAPI.VARIATIONAL_SYMBOLS[assetKey.toUpperCase()] || null,
      VariationalSwapAPI.VARIATIONAL_SWAP_SYMBOLS[assetKey.toUpperCase()] || null
    );

    const results = await Promise.all([
      this.fetchHyperliquid(config, orderSizeUsd),
      this.fetchLighter(config, orderSizeUsd),
      this.fetchAster(config, orderSizeUsd),
      this.fetchVeranta(config, assetKey, orderSizeUsd, isLong),
      this.fetchExtended(config, orderSizeUsd),
      this.fetchEdgex(config, orderSizeUsd, direction),
      this.fetchGrvt(config, orderSizeUsd, direction),
      this.fetchVariational(assetKey, orderSizeUsd, isLong),
      this.fetchVariationalSwap(assetKey, orderSizeUsd, isLong),
      this.fetchOndo(config, orderSizeUsd),
      this.fetchPacifica(config, orderSizeUsd),
      this.fetchRisex(config, orderSizeUsd),
      this.fetchTxflow(config, orderSizeUsd),
      this.fetchBinance(assetKey, orderSizeUsd),
      this.fetchBybit(assetKey, orderSizeUsd),
      this.fetchBitget(assetKey, orderSizeUsd),
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
    const keyUp = config.symbol_key.toUpperCase();
    const binSym = BinanceAPI.SYMBOLS[keyUp];
    const bybSym = BybitAPI.SYMBOLS[keyUp];
    const bgtSym = BitgetAPI.SYMBOLS[keyUp];

    const [hl, lt, as, ex, ed, gr, on, pa, rx, tf, bn, by, bg] =
      await Promise.all([
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
        config.risex_market_id
          ? this.risex.getFees(config.risex_market_id)
          : Promise.resolve<[number | null, number | null]>([null, null]),
        config.txflow_symbol
          ? this.txflow.getFees()
          : Promise.resolve<[number | null, number | null]>([null, null]),
        binSym
          ? this.binance.getFees(binSym)
          : Promise.resolve<[number | null, number | null]>([null, null]),
        bybSym
          ? this.bybit.getFees(bybSym)
          : Promise.resolve<[number | null, number | null]>([null, null]),
        bgtSym
          ? this.bitget.getFees(bgtSym)
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
      risex: rx,
      txflow: tf,
      binance: bn,
      bybit: by,
      bitget: bg,
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

    if (result.avantis) {
      feeStructure.avantis = {
        open: result.avantis.open_fee_bps ?? null,
        close: result.avantis.close_fee_bps ?? null,
      };
    }
    if (result.variational) {
      feeStructure.variational = {
        open: result.variational.open_fee_bps ?? null,
        close: result.variational.close_fee_bps ?? null,
      };
    }
    if (result.variational_swap) {
      feeStructure.variational_swap = {
        open: result.variational_swap.open_fee_bps ?? null,
        close: result.variational_swap.close_fee_bps ?? null,
      };
    }

    const isLong = direction === "long";
    for (const name of DIRECTION_SLIP_VENUES) {
      const exData = result[name];
      if (!exData) continue;
      const buyRaw = exData.buy_slippage_bps;
      const sellRaw = exData.sell_slippage_bps;
      if (buyRaw == null || sellRaw == null) continue;
      const buySlip = round3(finite(buyRaw));
      const sellSlip = round3(finite(sellRaw));
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
      let effectiveSpread: number;
      if (name === "avantis") {
        const openS = exData.opening_slippage_bps;
        if (openS == null || !Number.isFinite(Number(openS))) {
          exData.total_cost_bps = null;
          exData.exchange = name;
          exData.filled = false;
          continue;
        }
        // Veranta charges spread on open only, so close spread is not added.
        effectiveSpread = Number(openS);
      } else if (
        exData.opening_slippage_bps == null ||
        exData.closing_slippage_bps == null
      ) {
        effectiveSpread = slippage * 2;
      } else {
        effectiveSpread =
          finite(exData.opening_slippage_bps) +
          finite(exData.closing_slippage_bps);
      }
      const fOpen = fees.open;
      const fClose = fees.close;
      if (fOpen === null || fClose === null) continue;

      const totalCost = round3(effectiveSpread + fOpen + fClose);
      exData.effective_spread_bps = round3(effectiveSpread);
      exData.open_fee_bps = round3(fOpen);
      exData.close_fee_bps = round3(fClose);
      exData.total_cost_bps = totalCost;
      exData.exchange = name;

      if (exData.executed !== "PARTIAL" && exData.market_status !== "closed") {
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
