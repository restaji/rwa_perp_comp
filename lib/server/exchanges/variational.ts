import http2 from "http2";
import { floorLeverage } from "../models";

const BASE = "https://omni.variational.io";
const SETTLEMENT_ASSET = "USDC";
const REF_QTY = 0.001;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CHROME_CIPHERS = [
  "TLS_AES_128_GCM_SHA256",
  "TLS_AES_256_GCM_SHA384",
  "TLS_CHACHA20_POLY1305_SHA256",
  "ECDHE-ECDSA-AES128-GCM-SHA256",
  "ECDHE-RSA-AES128-GCM-SHA256",
  "ECDHE-ECDSA-AES256-GCM-SHA384",
  "ECDHE-RSA-AES256-GCM-SHA384",
  "ECDHE-ECDSA-CHACHA20-POLY1305",
  "ECDHE-RSA-CHACHA20-POLY1305",
  "ECDHE-RSA-AES128-SHA",
  "ECDHE-RSA-AES256-SHA",
  "AES128-GCM-SHA256",
  "AES256-GCM-SHA384",
  "AES128-SHA",
  "AES256-SHA",
].join(":");

let sharedH2Session: http2.ClientHttp2Session | null = null;

function getH2Session(): http2.ClientHttp2Session {
  if (
    sharedH2Session &&
    !sharedH2Session.closed &&
    !sharedH2Session.destroyed
  ) {
    return sharedH2Session;
  }
  const session = http2.connect(BASE, {
    ciphers: CHROME_CIPHERS,
    ecdhCurve: "X25519:P-256:P-384",
    minVersion: "TLSv1.2",
    maxVersion: "TLSv1.3",
  });
  session.on("error", () => {
    try {
      session.destroy();
    } catch {
      // ignore
    }
    if (sharedH2Session === session) sharedH2Session = null;
  });
  session.on("close", () => {
    if (sharedH2Session === session) sharedH2Session = null;
  });
  session.setTimeout(30_000, () => {
    try {
      session.close();
    } catch {
      // ignore
    }
    if (sharedH2Session === session) sharedH2Session = null;
  });
  sharedH2Session = session;
  return session;
}

function h2RequestJson(
  method: "GET" | "POST",
  path: string,
  bodyObj?: Record<string, any>,
  underlying: string = "XAU",
  timeoutMs: number = 12_000
): Promise<Record<string, any> | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (val: Record<string, any> | null) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };

    let client: http2.ClientHttp2Session;
    try {
      client = getH2Session();
    } catch {
      return finish(null);
    }

    const timer = setTimeout(() => finish(null), timeoutMs);

    const bodyStr = bodyObj ? JSON.stringify(bodyObj) : "";
    const headers: http2.OutgoingHttpHeaders = {
      ":method": method,
      ":path": path,
      ":authority": "omni.variational.io",
      ":scheme": "https",
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.9",
      origin: BASE,
      referer: `${BASE}/perpetual/${underlying}`,
      "user-agent": BROWSER_UA,
      "sec-ch-ua":
        '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
    };

    if (method === "POST") {
      headers["content-type"] = "application/json";
      headers["content-length"] = String(Buffer.byteLength(bodyStr));
    }

    try {
      const req = client.request(headers);
      let status = 0;
      let raw = "";

      req.on("response", (resHeaders) => {
        status = Number(resHeaders[":status"] || 0);
      });
      req.on("data", (chunk) => {
        raw += chunk;
      });
      req.on("end", () => {
        clearTimeout(timer);
        if (status !== 200 || !raw) {
          return finish(null);
        }
        try {
          finish(JSON.parse(raw));
        } catch {
          finish(null);
        }
      });
      req.on("error", () => {
        clearTimeout(timer);
        finish(null);
      });

      if (method === "POST" && bodyStr) {
        req.write(bodyStr);
      }
      req.end();
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}

export interface VariationalSpec {
  underlying: string;
  instrument_type: string;
  kind: string;
}

interface RefMarkEntry {
  mark: number;
  index: number | null;
  ts: number;
}

export class VariationalAPI {
  static readonly VARIATIONAL_INSTRUMENTS: Record<string, VariationalSpec> = {
    // Commodities
    XAU: { underlying: "XAU", instrument_type: "perpetual_rwa_future", kind: "commodity" },
    XAG: { underlying: "XAG", instrument_type: "perpetual_rwa_future", kind: "commodity" },
    WTI: { underlying: "CL", instrument_type: "perpetual_rwa_future", kind: "commodity" },
    BRENT: { underlying: "BZ", instrument_type: "perpetual_rwa_future", kind: "commodity" },
    NATGAS: { underlying: "NATGAS", instrument_type: "perpetual_rwa_future", kind: "commodity" },
    COPPER: { underlying: "COPPER", instrument_type: "perpetual_rwa_future", kind: "commodity" },
    // Pre-IPO / private equity
    SPCX: { underlying: "SPCX", instrument_type: "perpetual_rwa_future", kind: "equity" },
    OPENAI: { underlying: "OPENAI", instrument_type: "perpetual_rwa_future", kind: "equity" },
    ANTHROPIC: { underlying: "ANTHROPIC", instrument_type: "perpetual_rwa_future", kind: "equity" },
    QNTX: { underlying: "QNTX", instrument_type: "perpetual_rwa_future", kind: "equity" },
    // Listed equity
    AMD: { underlying: "AMD", instrument_type: "perpetual_rwa_future", kind: "equity" },
    CBRS: { underlying: "CBRS", instrument_type: "perpetual_rwa_future", kind: "equity" },
    COIN: { underlying: "COIN", instrument_type: "perpetual_rwa_future", kind: "equity" },
    CRCL: { underlying: "CRCL", instrument_type: "perpetual_rwa_future", kind: "equity" },
    INTC: { underlying: "INTC", instrument_type: "perpetual_rwa_future", kind: "equity" },
    LITE: { underlying: "LITE", instrument_type: "perpetual_rwa_future", kind: "equity" },
    MRVL: { underlying: "MRVL", instrument_type: "perpetual_rwa_future", kind: "equity" },
    MSTR: { underlying: "MSTR", instrument_type: "perpetual_rwa_future", kind: "equity" },
    MU: { underlying: "MU", instrument_type: "perpetual_rwa_future", kind: "equity" },
    NVDA: { underlying: "NVDA", instrument_type: "perpetual_rwa_future", kind: "equity" },
    QCOM: { underlying: "QCOM", instrument_type: "perpetual_rwa_future", kind: "equity" },
    RKLB: { underlying: "RKLB", instrument_type: "perpetual_rwa_future", kind: "equity" },
    SNDK: { underlying: "SNDK", instrument_type: "perpetual_rwa_future", kind: "equity" },
    TSLA: { underlying: "TSLA", instrument_type: "perpetual_rwa_future", kind: "equity" },
    TSM: { underlying: "TSM", instrument_type: "perpetual_rwa_future", kind: "equity" },
    USAR: { underlying: "USAR", instrument_type: "perpetual_rwa_future", kind: "equity" },
    SKHY: { underlying: "SKHY", instrument_type: "perpetual_rwa_future", kind: "equity" },
    LLY: { underlying: "LLY", instrument_type: "perpetual_rwa_future", kind: "equity" },
    BE: { underlying: "BE", instrument_type: "perpetual_rwa_future", kind: "equity" },
    STRC: { underlying: "STRC", instrument_type: "perpetual_rwa_future", kind: "equity" },
    DELL: { underlying: "DELL", instrument_type: "perpetual_rwa_future", kind: "equity" },
    NBIS: { underlying: "NBIS", instrument_type: "perpetual_rwa_future", kind: "equity" },
    IREN: { underlying: "IREN", instrument_type: "perpetual_rwa_future", kind: "equity" },
    ARM: { underlying: "ARM", instrument_type: "perpetual_rwa_future", kind: "equity" },
    MRNA: { underlying: "MRNA", instrument_type: "perpetual_rwa_future", kind: "equity" },
    NOW: { underlying: "NOW", instrument_type: "perpetual_rwa_future", kind: "equity" },
    CSCO: { underlying: "CSCO", instrument_type: "perpetual_rwa_future", kind: "equity" },
    KLAC: { underlying: "KLAC", instrument_type: "perpetual_rwa_future", kind: "equity" },
    TXN: { underlying: "TXN", instrument_type: "perpetual_rwa_future", kind: "equity" },
    APP: { underlying: "APP", instrument_type: "perpetual_rwa_future", kind: "equity" },
    ALAB: { underlying: "ALAB", instrument_type: "perpetual_rwa_future", kind: "equity" },
    ADBE: { underlying: "ADBE", instrument_type: "perpetual_rwa_future", kind: "equity" },
    TER: { underlying: "TER", instrument_type: "perpetual_rwa_future", kind: "equity" },
    SHOP: { underlying: "SHOP", instrument_type: "perpetual_rwa_future", kind: "equity" },
    TTWO: { underlying: "TTWO", instrument_type: "perpetual_rwa_future", kind: "equity" },
    WMT: { underlying: "WMT", instrument_type: "perpetual_rwa_future", kind: "equity" },
    UBER: { underlying: "UBER", instrument_type: "perpetual_rwa_future", kind: "equity" },
    SOFI: { underlying: "SOFI", instrument_type: "perpetual_rwa_future", kind: "equity" },
    BOT: { underlying: "BOT", instrument_type: "perpetual_rwa_future", kind: "equity" },
    // ETFs
    US100: { underlying: "QQQ", instrument_type: "perpetual_rwa_future", kind: "ETF" },
    US500: { underlying: "US500", instrument_type: "perpetual_rwa_future", kind: "ETF" },
    DRAM: { underlying: "DRAM", instrument_type: "perpetual_rwa_future", kind: "ETF" },
    EWJ: { underlying: "EWJ", instrument_type: "perpetual_rwa_future", kind: "ETF" },
    EWY: { underlying: "EWY", instrument_type: "perpetual_rwa_future", kind: "ETF" },
    SOXL: { underlying: "SOXL", instrument_type: "perpetual_rwa_future", kind: "ETF" },
  };

  static readonly VARIATIONAL_SYMBOLS: Record<string, string> = Object.fromEntries(
    Object.entries(VariationalAPI.VARIATIONAL_INSTRUMENTS).map(([k, spec]) => [
      k,
      spec.underlying,
    ])
  );

  private markCache: Record<string, RefMarkEntry> = {};
  private configCache: { takerFeeBps: number; maxLevDefault: number; ts: number } | null = null;

  async fetchQuote(
    assetKey: string,
    qty: number
  ): Promise<Record<string, any> | null> {
    const spec = VariationalAPI.VARIATIONAL_INSTRUMENTS[assetKey.toUpperCase()];
    if (!spec) return null;
    const underlying = spec.underlying;
    const body = {
      instrument: { settlement_asset: SETTLEMENT_ASSET, ...spec },
      qty: String(qty),
    };
    return h2RequestJson("POST", "/api/quotes/simple", body, underlying);
  }

  private async getConfig(): Promise<{
    takerFeeBps: number;
    maxLevDefault: number;
  }> {
    if (this.configCache && Date.now() - this.configCache.ts < 600_000) {
      return this.configCache;
    }
    let takerFeeBps = 0;
    try {
      const data = await h2RequestJson("GET", "/api/metadata/config");
      if (data?.futures_taker_fee != null) {
        takerFeeBps = Number(data.futures_taker_fee) * 10000;
      }
    } catch {
      // default 0 bps on Omni
    }
    this.configCache = {
      takerFeeBps,
      maxLevDefault: 20,
      ts: Date.now(),
    };
    return this.configCache;
  }

  private async referenceMark(assetKey: string): Promise<RefMarkEntry | null> {
    const key = assetKey.toUpperCase();
    const cached = this.markCache[key];
    // Short 3s TTL so top-of-book mark stays fresh while sharing across quick size/direction toggles
    if (cached && Date.now() - cached.ts < 3_000) {
      return cached;
    }
    const q = await this.fetchQuote(key, REF_QTY);
    if (!q) return cached || null;
    const mark = Number(q.mark_price);
    const index = q.index_price != null ? Number(q.index_price) : null;
    if (Number.isFinite(mark) && mark > 0) {
      const entry: RefMarkEntry = {
        mark,
        index: Number.isFinite(index) ? index : null,
        ts: Date.now(),
      };
      this.markCache[key] = entry;
      return entry;
    }
    return cached || null;
  }

  async calculateCost(
    assetKey: string,
    orderSizeUsd: number,
    isLong: boolean = true
  ): Promise<Record<string, any> | null> {
    const key = assetKey.toUpperCase();
    if (!VariationalAPI.VARIATIONAL_INSTRUMENTS[key]) return null;
    const display = VariationalAPI.VARIATIONAL_SYMBOLS[key] || key;

    const refEntry = await this.referenceMark(key);
    if (!refEntry || refEntry.mark <= 0) return null;

    const qty = orderSizeUsd / refEntry.mark;
    if (qty <= 0) return null;

    const [quote, cfg] = await Promise.all([
      this.fetchQuote(key, qty),
      this.getConfig(),
    ]);
    if (!quote) return null;

    const bid = Number(quote.bid);
    const ask = Number(quote.ask);
    const markPrice = Number(quote.mark_price);
    const indexPrice =
      quote.index_price != null ? Number(quote.index_price) : null;
    const filledQty = quote.qty != null ? Number(quote.qty) : qty;

    if (
      !Number.isFinite(bid) ||
      !Number.isFinite(ask) ||
      !Number.isFinite(markPrice)
    ) {
      return null;
    }

    // Anchor per-side slippage to the unshifted top-of-book mark price (adjusted for any index tick),
    // matching Variational's UI formula: (ask - refMark)/refMark for Long, (refMark - bid)/refMark for Short.
    const indexDelta =
      refEntry.index !== null && indexPrice !== null && Number.isFinite(indexPrice)
        ? indexPrice - refEntry.index
        : 0;
    const rawAnchor = refEntry.mark + indexDelta;
    const anchorMid =
      rawAnchor > bid && rawAnchor < ask ? rawAnchor : markPrice;
    if (anchorMid <= 0) return null;

    const buySlipBps = ((ask - anchorMid) / anchorMid) * 10000;
    const sellSlipBps = ((anchorMid - bid) / anchorMid) * 10000;
    const avgSlipBps = (buySlipBps + sellSlipBps) / 2;
    const spreadBps = ((ask - bid) / anchorMid) * 10000;

    // Direction-aware open & close:
    // If Long: open = Long (buySlipBps), close = Short (sellSlipBps)
    // If Short: open = Short (sellSlipBps), close = Long (buySlipBps)
    const openingSlip = isLong ? buySlipBps : sellSlipBps;
    const closingSlip = isLong ? sellSlipBps : buySlipBps;

    const feeBps = cfg.takerFeeBps;
    const maxLev = floorLeverage(cfg.maxLevDefault);
    const totalCostBps = buySlipBps + sellSlipBps + 2 * feeBps;

    let filled = true;
    const limits = quote.qty_limits;
    if (limits?.bid?.max_qty != null && limits?.ask?.max_qty != null) {
      const maxQty = Math.min(
        Number(limits.bid.max_qty),
        Number(limits.ask.max_qty)
      );
      if (Number.isFinite(maxQty)) {
        filled = qty <= maxQty;
      }
    }

    const filledUsd = filledQty * markPrice;
    const notional = qty * markPrice;

    return {
      symbol: display,
      name: display,
      underlying: display,
      max_leverage: maxLev,
      executed: filled ? true : "PARTIAL",
      filled,
      mid_price: anchorMid,
      mark_price: markPrice,
      index_price: indexPrice,
      open_fee_bps: feeBps,
      close_fee_bps: feeBps,
      fee_bps: feeBps,
      maker_fee_bps: feeBps,
      base_spread_bps: spreadBps,
      slippage_bps: avgSlipBps,
      buy_slippage_bps: buySlipBps,
      sell_slippage_bps: sellSlipBps,
      opening_slippage_bps: openingSlip,
      closing_slippage_bps: closingSlip,
      slippage_type: "opening_closing",
      total_cost_bps: totalCostBps,
      order_size_usd: orderSizeUsd,
      filled_usd: filledUsd,
      unfilled_usd: Math.max(0, notional - filledUsd),
      notional,
      qty: filledQty,
      is_long: isLong,
      bid,
      ask,
      quote_id: quote.quote_id,
      quotes_updated_at: quote.timestamp,
      timestamp: Date.now() / 1000,
    };
  }
}
