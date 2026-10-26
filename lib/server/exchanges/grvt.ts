import {
  ExecutionCalculator,
  floorLeverage,
  StandardizedOrderbook,
} from "../models";

const BASE_URL = "https://market-data.grvt.io/full/v1";
const AUTH_URL = "https://edge.grvt.io/auth/api_key/login";
const TRADES_URL = "https://trades.grvt.io/lite/v1";

// Standard GRVT retail tier-0 fees (ft=450 -> 4.5 bps taker, fm=-1 -> -0.01 bps maker)
// Used as fallback when edge.grvt.io is geo-blocked by datacenter IP (e.g. US serverless regions).
const DEFAULT_TAKER_FEE_BPS = 4.5;
const DEFAULT_MAKER_FEE_BPS = -0.01;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export class GRVTAPI {
  private instrumentMeta: Record<string, { funding_interval_hours: number }> =
    {};
  private instrumentMetaLoadedAt = 0;
  private leverageCache: Record<string, number | null> = {};
  private takerFeeBps: number | null = null;
  private makerFeeBps: number | null = null;
  private lastAuthAttemptTs = 0;
  private feeStatus: Record<string, any> = {
    code: "pending",
    message: "Fee load not finished yet.",
  };
  private lastOrderbookDebug: Record<string, any> = {};

  private get apiKey(): string {
    return process.env.GRVT_API_KEY || "";
  }

  private extractGravityToken(res: Response): string | null {
    const getSetCookie = (res.headers as any).getSetCookie;
    const cookies: string[] =
      typeof getSetCookie === "function"
        ? getSetCookie.call(res.headers)
        : [res.headers.get("set-cookie") || ""];

    for (const c of cookies) {
      if (!c || !c.includes("gravity=")) continue;
      const part = c
        .split(";")
        .map((p) => p.trim())
        .find((p) => p.startsWith("gravity="));
      if (part) return part.split("=")[1] || null;
    }
    return null;
  }

  private async authenticateAndLoadFees(): Promise<void> {
    if (this.takerFeeBps !== null) return;
    if (!this.apiKey) {
      this.takerFeeBps = DEFAULT_TAKER_FEE_BPS;
      this.makerFeeBps = DEFAULT_MAKER_FEE_BPS;
      this.feeStatus = {
        code: "default_tier0",
        message: "Using default GRVT retail tier-0 fees (4.5 bps taker).",
      };
      return;
    }
    if (Date.now() - this.lastAuthAttemptTs < 30_000) return;
    this.lastAuthAttemptTs = Date.now();

    try {
      const resp = await fetch(AUTH_URL, {
        method: "POST",
        headers: {
          Cookie: "rm=true;",
          "Content-Type": "application/json",
          "User-Agent": BROWSER_UA,
        },
        body: JSON.stringify({ api_key: this.apiKey }),
        cache: "no-store",
      });

      const gravityToken = this.extractGravityToken(resp);
      const accountId =
        resp.headers.get("x-grvt-account-id") ||
        resp.headers.get("X-Grvt-Account-Id");

      if (!gravityToken || !accountId) {
        this.takerFeeBps = DEFAULT_TAKER_FEE_BPS;
        this.makerFeeBps = DEFAULT_MAKER_FEE_BPS;
        this.feeStatus = {
          code: "fallback_tier0",
          http_status: resp.status,
          message:
            "Auth endpoint blocked or unavailable; using tier-0 retail fees (4.5 bps).",
        };
        return;
      }

      const feeResp = await fetch(`${TRADES_URL}/funding_account_summary`, {
        method: "POST",
        headers: {
          Cookie: `gravity=${gravityToken}`,
          "X-Grvt-Account-Id": accountId,
          "Content-Type": "application/json",
          "User-Agent": BROWSER_UA,
        },
        body: JSON.stringify({}),
        cache: "no-store",
      });

      if (!feeResp.ok) {
        this.takerFeeBps = DEFAULT_TAKER_FEE_BPS;
        this.makerFeeBps = DEFAULT_MAKER_FEE_BPS;
        return;
      }

      const feeJson = await feeResp.json();
      const tier = feeJson?.t || {};
      this.takerFeeBps =
        tier.ft != null ? Number(tier.ft) / 100 : DEFAULT_TAKER_FEE_BPS;
      this.makerFeeBps =
        tier.fm != null ? Number(tier.fm) / 100 : DEFAULT_MAKER_FEE_BPS;
      this.feeStatus = { code: "ok", message: "Taker/maker fees loaded." };
    } catch {
      this.takerFeeBps = DEFAULT_TAKER_FEE_BPS;
      this.makerFeeBps = DEFAULT_MAKER_FEE_BPS;
    }
  }

  private async loadInstrumentMeta(): Promise<void> {
    if (
      Object.keys(this.instrumentMeta).length > 0 &&
      Date.now() - this.instrumentMetaLoadedAt < 300_000
    ) {
      return;
    }
    try {
      const resp = await fetch(`${BASE_URL}/all_instruments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          kind: ["PERPETUAL"],
          underlying: [],
          quote: ["USDT"],
          is_active: true,
        }),
        cache: "no-store",
      });
      if (!resp.ok) return;
      const json = await resp.json();
      for (const inst of json?.result || []) {
        if (inst?.instrument) {
          this.instrumentMeta[inst.instrument] = {
            funding_interval_hours: inst.funding_interval_hours ?? 8,
          };
        }
      }
      this.instrumentMetaLoadedAt = Date.now();
    } catch {
      // ignore
    }
  }

  async getFees(instrument: string): Promise<[number | null, number | null]> {
    await Promise.all([
      this.loadInstrumentMeta(),
      this.authenticateAndLoadFees(),
    ]);
    return [
      this.takerFeeBps ?? DEFAULT_TAKER_FEE_BPS,
      this.makerFeeBps ?? DEFAULT_MAKER_FEE_BPS,
    ];
  }

  async getMaxLeverage(instrument: string): Promise<number | null> {
    if (instrument in this.leverageCache) {
      return floorLeverage(this.leverageCache[instrument]);
    }
    try {
      const resp = await fetch(`${BASE_URL}/margin_rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ instrument }),
        cache: "no-store",
      });
      if (!resp.ok) {
        this.leverageCache[instrument] = null;
        return null;
      }
      const json = await resp.json();
      const brackets = json?.risk_brackets || [];
      const lev =
        Array.isArray(brackets) && brackets.length > 0
          ? floorLeverage(brackets[0]?.max_leverage)
          : null;
      this.leverageCache[instrument] = lev;
      return lev;
    } catch {
      this.leverageCache[instrument] = null;
      return null;
    }
  }

  async getOrderbook(
    instrument: string,
    depth: number = 500
  ): Promise<StandardizedOrderbook | null> {
    try {
      const resp = await fetch(`${BASE_URL}/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ instrument, depth }),
        cache: "no-store",
      });
      if (!resp.ok) {
        this.lastOrderbookDebug = {
          code: "orderbook_http_error",
          http_status: resp.status,
          instrument,
        };
        return null;
      }
      const json = await resp.json();
      const book = json?.result || {};
      const rawAsks = book.asks || [];
      const rawBids = book.bids || [];
      if (!rawAsks.length || !rawBids.length) {
        this.lastOrderbookDebug = {
          code: "orderbook_no_sides",
          instrument,
        };
        return null;
      }

      const bestAsk = Number(rawAsks[0]?.price || 0);
      const bestBid = Number(rawBids[0]?.price || 0);
      if (bestAsk <= 0 || bestBid <= 0) return null;

      return {
        bids: rawBids.map((b: any) => ({
          price: Number(b.price),
          qty: Number(b.size),
        })),
        asks: rawAsks.map((a: any) => ({
          price: Number(a.price),
          qty: Number(a.size),
        })),
        best_bid: bestBid,
        best_ask: bestAsk,
        mid_price: (bestAsk + bestBid) / 2,
        timestamp: Date.now() / 1000,
      };
    } catch {
      return null;
    }
  }

  async calculateExecutionCost(
    instrument: string,
    orderSizeUsd: number,
    direction: string = "long",
    symbol: string | null = null
  ): Promise<[Record<string, any> | null, Record<string, any> | null]> {
    const [, ob, maxLev] = await Promise.all([
      this.authenticateAndLoadFees(),
      this.getOrderbook(instrument),
      this.getMaxLeverage(instrument),
    ]);

    const takerFee = this.takerFeeBps ?? DEFAULT_TAKER_FEE_BPS;
    const makerFee = this.makerFeeBps ?? DEFAULT_MAKER_FEE_BPS;

    if (!ob) {
      return [
        null,
        this.lastOrderbookDebug || {
          code: "orderbook_unavailable",
          instrument,
        },
      ];
    }

    const result = ExecutionCalculator.calculateExecutionCost(
      ob,
      orderSizeUsd,
      takerFee,
      takerFee
    );
    if (!result) {
      return [
        null,
        {
          code: "execution_walk_failed",
          instrument,
        },
      ];
    }

    const buySlipBps = Number(result.buy_slippage_bps || 0);
    const sellSlipBps = Number(result.sell_slippage_bps || 0);
    const isLong = direction.toLowerCase() === "long";

    result.opening_slippage_bps = isLong ? buySlipBps : sellSlipBps;
    result.closing_slippage_bps = isLong ? sellSlipBps : buySlipBps;
    result.slippage_type = "opening_closing";
    result.total_cost_bps = buySlipBps + sellSlipBps + takerFee * 2;
    result.symbol = symbol || instrument;
    result.max_leverage = maxLev;
    result.taker_fee_bps = takerFee;
    result.maker_fee_bps = makerFee;
    return [result, null];
  }
}
