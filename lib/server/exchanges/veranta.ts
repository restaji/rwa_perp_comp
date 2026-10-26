import { floorLeverage } from "../models";

const TRADING_API = "https://data.veranta.xyz/v2/trading";
const RISK_API = "https://prod-api.veranta.xyz/risk/v2";
const DEFAULT_TRADER =
  process.env.VERANTA_RISK_TRADER ||
  process.env.AVANTIS_RISK_TRADER ||
  "0x0FaE768Ef2191fB74968cd1e5D14EBd35b90Ff85";
const ORDER_TYPE_MARKET = 0;

export class VerantaAPI {
  static readonly PAIRS: Record<string, number> = {
    // Commodities
    XAU: 21,
    XAG: 20,
    WTI: 96,
    BRENT: 97,
    // Forex
    EURUSD: 11,
    USDJPY: 12,
    GBPUSD: 13,
    USDCAD: 14,
    USDCHF: 15,
    USDSEK: 16,
    AUDUSD: 17,
    NZDUSD: 18,
    USDSGD: 19,
    USDCNH: 66,
    // Indices
    US500: 78,
    US100: 79,
    // Equities
    COIN: 80,
    NVDA: 81,
    AAPL: 82,
    AMZN: 83,
    MSFT: 84,
    META: 85,
    TSLA: 86,
    GOOG: 87,
    HOOD: 91,
    SPCX: 105,
    AMD: 98,
    INTC: 99,
    MU: 100,
    SNDK: 101,
    CBRS: 102,
    EWY: 103,
    BABA: 104,
    CRCL: 106,
    MRVL: 107,
    MSTR: 108,
    BB: 109,
    PLTR: 110,
    AVGO: 111,
    NFLX: 112,
    CRWV: 113,
    SKHY: 114,
    LLY: 120,
    BE: 121,
    LITE: 122,
    STRC: 123,
    DELL: 124,
    NBIS: 125,
    IREN: 126,
    ARM: 127,
    MRNA: 128,
    RKLB: 129,
    WDC: 130,
    NOW: 131,
    AMGN: 135,
    CSCO: 136,
    KLAC: 137,
    LRCX: 138,
    TXN: 139,
    PANW: 140,
    APP: 141,
    ALAB: 142,
    DDOG: 143,
    CEG: 144,
    SNPS: 145,
    CDNS: 146,
    MPWR: 147,
    FTNT: 148,
    ADBE: 149,
    INTU: 150,
    ADI: 151,
    TER: 152,
    NXPI: 153,
    SHOP: 154,
    WDAY: 155,
    ADSK: 156,
    MCHP: 157,
    BKNG: 158,
    MELI: 159,
    ISRG: 160,
    TMUS: 161,
    ABNB: 162,
    DASH: 163,
    PDD: 164,
    PYPL: 165,
    TTWO: 166,
    WMT: 167,
    GILD: 168,
    VRTX: 169,
    REGN: 170,
    LIN: 171,
    ADP: 172,
    HON: 173,
    STX: 175,
    AXON: 176,
    VST: 177,
    ANET: 178,
    UBER: 179,
    BA: 180,
    SOFI: 181,
    GRAB: 182,
    ASTS: 183,
    BOT: 184,
    // Korean equities (/KRW)
    NAVERKRW: 185,
    HYUNDAISTEELKRW: 186,
    HYUNDAIKRW: 187,
    SAMSUNGKRW: 188,
    NHISKRW: 189,
    SAMSUNGEMKRW: 190,
    HDKSOEKRW: 191,
    HMMKRW: 192,
    SKINCKRW: 193,
    KAKAOKRW: 194,
    HANMIKRW: 195,
    LGCHEMKRW: 196,
    LGELECKRW: 197,
    KRAFTONKRW: 198,
    HANWHASYSKRW: 199,
    LGESKRW: 200,
    KODEX200KRW: 201,
  };

  private pairData: Record<string, any> | null = null;
  private groupInfo: Record<string, any> | null = null;
  private lastFetch = 0;
  private readonly cacheTtlMs = 30_000;

  async fetchSocketData(): Promise<void> {
    if (
      this.pairData &&
      Object.keys(this.pairData).length > 0 &&
      Date.now() - this.lastFetch < this.cacheTtlMs
    ) {
      return;
    }
    try {
      const res = await fetch(TRADING_API, { cache: "no-store" });
      if (!res.ok) return;
      const payload = await res.json();
      const data = "pairInfos" in payload ? payload : payload?.data || {};
      this.pairData = data.pairInfos || {};
      this.groupInfo = data.groupInfo || {};
      this.lastFetch = Date.now();
    } catch {
      this.pairData = this.pairData || {};
      this.groupInfo = this.groupInfo || {};
    }
  }

  private async getPairInfo(
    assetKey: string
  ): Promise<[number, Record<string, any>] | null> {
    await this.fetchSocketData();
    const pairIdx = VerantaAPI.PAIRS[assetKey.toUpperCase()];
    if (pairIdx === undefined || !this.pairData) return null;
    const pairInfo = this.pairData[String(pairIdx)];
    if (!pairInfo || !pairInfo.isPairListed) return null;
    return [pairIdx, pairInfo];
  }

  async isPairListed(assetKey: string): Promise<boolean> {
    const pairIdx = VerantaAPI.PAIRS[assetKey.toUpperCase()];
    if (pairIdx === undefined) return false;
    if (!this.pairData) {
      await this.fetchSocketData();
    }
    if (!this.pairData || Object.keys(this.pairData).length === 0) {
      return true;
    }
    const pairInfo = this.pairData[String(pairIdx)];
    return Boolean(pairInfo?.isPairListed);
  }

  private impliedCoinPrice(pairInfo: Record<string, any>): number | null {
    const oi = pairInfo.openInterest || {};
    const co = pairInfo.coinOI || {};
    const usdTotal = Number(oi.long || 0) + Number(oi.short || 0);
    const coinTotal = Number(co.long || 0) + Number(co.short || 0);
    if (coinTotal <= 0 || usdTotal <= 0) return null;
    return usdTotal / coinTotal;
  }

  private takerFeesBps(pairInfo: Record<string, any>): [number, number] {
    const extra = pairInfo.additionalPairParams2 || {};
    const openBps = Number(extra.openTakerFeeP || 0) * 100;
    const closeBps = Number(extra.closeTakerFeeP || 0) * 100;
    return [openBps, closeBps];
  }

  private async callRiskSpread(
    pairIdx: number,
    coinSize: number,
    isLong: boolean
  ): Promise<Record<string, any> | null> {
    if (coinSize <= 0) return null;
    try {
      const body = {
        pairIndex: pairIdx,
        trader: DEFAULT_TRADER,
        coinSize10: String(Math.trunc(coinSize * 1e10)),
        isLong: Boolean(isLong),
        isOpen: true,
        orderType: ORDER_TYPE_MARKET,
      };
      const res = await fetch(`${RISK_API}/spread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  private pct10ToBps(raw: unknown): number {
    if (raw === null || raw === undefined) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n / 1e8 : 0;
  }

  private priceImpactSpreadBps(
    pairInfo: Record<string, any>,
    positionSize: number,
    isLong: boolean
  ): number {
    const params = pairInfo.pairParams || {};
    const depth = Number(
      (isLong ? params.onePercentDepthAbove : params.onePercentDepthBelow) || 0
    );
    const param = Number(pairInfo.priceImpactMultiplier || 0);
    if (positionSize <= 0 || depth <= 0 || param <= 0) return 0;
    const linearPct = positionSize / depth;
    const expPct = Math.exp(Math.min(linearPct / param, 20.0)) - 1;
    return Math.max(expPct, linearPct) * 100;
  }

  private skewImpactSpreadBps(
    pairInfo: Record<string, any>,
    positionSize: number,
    isLong: boolean
  ): number {
    const param = Number(pairInfo.skewImpactMultiplier || 0);
    if (param <= 0 || positionSize <= 0) return 0;
    const oi = pairInfo.openInterest || {};
    const longOi = Number(oi.long || 0);
    const shortOi = Number(oi.short || 0);
    const total = longOi + shortOi;
    const sBefore = total > 0 ? longOi / total : 0.5;
    const sAfter = isLong
      ? (longOi + positionSize) / (total + positionSize)
      : longOi / (total + positionSize);
    const delta =
      Math.exp(sAfter) -
      Math.exp(sBefore) +
      Math.exp(1 - sAfter) -
      Math.exp(1 - sBefore);
    return param * delta * 100;
  }

  private async getSpread(
    pairIdx: number,
    pairInfo: Record<string, any>,
    positionSizeUsd: number,
    isLong: boolean
  ): Promise<[number, Record<string, any>]> {
    const fixedBps = Number(pairInfo.spreadP || 0) * 100;
    const capPct = Number(pairInfo.storagePairParams?.posSpreadCap || 0);
    const capBps = capPct > 0 ? capPct * 100 : Infinity;

    const groupIndex = pairInfo.groupIndex ?? 0;
    const group = (this.groupInfo || {})[String(groupIndex)] || {};
    const groupDyn = Boolean(group.isSpreadDynamic);

    const coinPrice = this.impliedCoinPrice(pairInfo);
    const coinSize =
      coinPrice && coinPrice > 0 ? positionSizeUsd / coinPrice : 0;

    const risk =
      coinSize > 0
        ? await this.callRiskSpread(pairIdx, coinSize, isLong)
        : null;
    if (risk !== null) {
      const totalBps = this.pct10ToBps(risk.spreadPctWithoutFlow10);
      const withFlowBps = this.pct10ToBps(risk.estimatedSpreadPctWithFlow10);
      const spreadBps = totalBps;
      const dynamicBps = Math.max(0, spreadBps - fixedBps);
      return [
        spreadBps,
        {
          spread_bps: spreadBps,
          fixed_spread_bps: fixedBps,
          dynamic_spread_bps: dynamicBps,
          price_impact_spread_bps: dynamicBps,
          skew_impact_spread_bps: 0,
          is_dynamic_spread_enabled: groupDyn || dynamicBps > 0,
          spread_source: "risk_v2",
          spread_mechanism: risk.spreadMechanism ?? null,
          spread_bypass: Boolean(risk.byPass),
          estimated_spread_with_flow_bps: withFlowBps,
          coin_size: coinSize,
          coin_price: coinPrice,
        },
      ];
    }

    const impact = this.priceImpactSpreadBps(pairInfo, positionSizeUsd, isLong);
    const skew = this.skewImpactSpreadBps(pairInfo, positionSizeUsd, isLong);
    const spreadBps = Math.min(fixedBps + impact + skew, capBps);
    return [
      spreadBps,
      {
        spread_bps: spreadBps,
        fixed_spread_bps: fixedBps,
        dynamic_spread_bps: impact + skew,
        price_impact_spread_bps: impact,
        skew_impact_spread_bps: skew,
        is_dynamic_spread_enabled: groupDyn || impact > 0 || skew > 0,
        spread_source: "legacy_fallback",
        spread_mechanism: null,
        spread_bypass: false,
        estimated_spread_with_flow_bps: spreadBps,
        coin_size: coinSize,
        coin_price: coinPrice,
      },
    ];
  }

  async calculateCost(
    assetKey: string,
    orderSizeUsd: number,
    isLong: boolean = true
  ): Promise<Record<string, any> | null> {
    const info = await this.getPairInfo(assetKey);
    if (!info) return null;
    const [pairIdx, pairInfo] = info;

    const maxWalletOi = Number(pairInfo.maxWalletOI ?? Infinity);
    const pairMaxOi = Number(pairInfo.pairMaxOI || 0);
    const values = pairInfo.values || {};
    const oi = pairInfo.openInterest || {};

    const perSideCap = isLong
      ? (pairMaxOi * Number(values.maxLongOiP ?? 100)) / 100
      : (pairMaxOi * Number(values.maxShortOiP ?? 100)) / 100;
    const liqCap = Math.max(
      0,
      perSideCap - Number(isLong ? oi.long || 0 : oi.short || 0)
    );

    const maxOrder = liqCap > 0 ? Math.min(maxWalletOi, liqCap) : 0;
    const filled = orderSizeUsd <= maxOrder && maxOrder > 0;
    const filledUsd = maxOrder > 0 ? Math.min(orderSizeUsd, maxOrder) : 0;
    const unfilledUsd = Math.max(0, orderSizeUsd - filledUsd);

    const [openFeeBps, closeFeeBps] = this.takerFeesBps(pairInfo);
    const maxLev = pairInfo.leverages?.maxLeverage;

    const [spreadBps, spreadMeta] = await this.getSpread(
      pairIdx,
      pairInfo,
      filledUsd,
      isLong
    );
    const totalCost = spreadBps + openFeeBps + closeFeeBps;

    const avFrom = pairInfo.from;
    const avTo = pairInfo.to;
    const displaySymbol = avFrom && avTo ? `${avFrom}/${avTo}` : assetKey;

    const safe = (v: number) => (Number.isFinite(v) ? v : null);

    return {
      symbol: displaySymbol,
      max_leverage: floorLeverage(maxLev),
      executed: filled ? true : "PARTIAL",
      mid_price: spreadMeta.coin_price || 0,
      slippage_bps: spreadBps,
      opening_slippage_bps: spreadBps,
      closing_slippage_bps: 0,
      buy_slippage_bps: isLong ? spreadBps : 0,
      sell_slippage_bps: !isLong ? spreadBps : 0,
      slippage_type: "opening_closing",
      open_fee_bps: openFeeBps,
      close_fee_bps: closeFeeBps,
      maker_fee_bps: openFeeBps,
      total_cost_bps: totalCost,
      filled,
      order_size_usd: orderSizeUsd,
      filled_usd: filledUsd,
      unfilled_usd: unfilledUsd,
      max_order_size: safe(maxOrder),
      max_wallet_oi: safe(maxWalletOi),
      liquidity_cap: safe(liqCap),
      fixed_spread_bps: spreadMeta.fixed_spread_bps ?? 0,
      dynamic_spread_bps: spreadMeta.dynamic_spread_bps ?? 0,
      price_impact_spread_bps: spreadMeta.price_impact_spread_bps ?? 0,
      skew_impact_spread_bps: spreadMeta.skew_impact_spread_bps ?? 0,
      is_dynamic_spread_enabled: spreadMeta.is_dynamic_spread_enabled ?? false,
      spread_source: spreadMeta.spread_source,
      spread_mechanism: spreadMeta.spread_mechanism,
      spread_bypass: spreadMeta.spread_bypass ?? false,
      estimated_spread_with_flow_bps: spreadMeta.estimated_spread_with_flow_bps,
      buy: {
        filled,
        filled_usd: filledUsd,
        unfilled_usd: unfilledUsd,
        levels_used: 1,
        slippage_bps: isLong ? spreadBps : 0,
      },
      sell: {
        filled,
        filled_usd: filledUsd,
        unfilled_usd: unfilledUsd,
        levels_used: 1,
        slippage_bps: !isLong ? spreadBps : 0,
      },
      timestamp: Date.now() / 1000,
    };
  }
}
