import {
  VariationalAPI,
  VariationalSpec,
} from "./variational";

export class VariationalSwapAPI {
  static readonly VARIATIONAL_SWAP_INSTRUMENTS: Record<string, VariationalSpec> = {
    // Commodities (Swaps on Omni)
    XAU: {
      underlying: "XAUS",
      instrument_type: "swap",
      kind: "commodity",
      funding_interval_s: 0,
    },
    XAG: {
      underlying: "XAGS",
      instrument_type: "swap",
      kind: "commodity",
      funding_interval_s: 0,
    },
    WTI: {
      underlying: "USOILP",
      instrument_type: "swap",
      kind: "commodity",
      funding_interval_s: 0,
    },
    BRENT: {
      underlying: "UKOILP",
      instrument_type: "swap",
      kind: "commodity",
      funding_interval_s: 0,
    },
    COPPER: {
      underlying: "COPPP",
      instrument_type: "swap",
      kind: "commodity",
      funding_interval_s: 0,
    },
    // Indices (Swaps on Omni)
    US500: {
      underlying: "US500S",
      instrument_type: "swap",
      kind: "index",
      funding_interval_s: 0,
    },
    US100: {
      underlying: "US100S",
      instrument_type: "swap",
      kind: "index",
      funding_interval_s: 0,
    },
  };

  static readonly VARIATIONAL_SWAP_SYMBOLS: Record<string, string> =
    Object.fromEntries(
      Object.entries(VariationalSwapAPI.VARIATIONAL_SWAP_INSTRUMENTS).map(
        ([k, spec]) => [k, spec.underlying]
      )
    );

  private core: VariationalAPI;

  constructor(core?: VariationalAPI) {
    this.core = core || new VariationalAPI();
  }

  async fetchQuote(
    assetKey: string,
    qty: number
  ): Promise<Record<string, any> | null> {
    const spec =
      VariationalSwapAPI.VARIATIONAL_SWAP_INSTRUMENTS[assetKey.toUpperCase()];
    if (!spec) return null;
    return this.core.fetchQuoteForSpec(spec, qty);
  }

  async calculateCost(
    assetKey: string,
    orderSizeUsd: number,
    isLong: boolean = true
  ): Promise<Record<string, any> | null> {
    const key = assetKey.toUpperCase();
    const spec = VariationalSwapAPI.VARIATIONAL_SWAP_INSTRUMENTS[key];
    if (!spec) return null;
    const display = VariationalSwapAPI.VARIATIONAL_SWAP_SYMBOLS[key] || key;
    return this.core.calculateCostForSpec(spec, display, orderSizeUsd, isLong);
  }
}
