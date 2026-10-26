import fs from "fs";
import http2 from "http2";
import path from "path";
import { floorLeverage } from "../models";

const BASE = "https://omni.variational.io";
const SETTLEMENT_ASSET = "USDC";
const REF_QTY = 0.001;
const LAST_QUOTE_PATH = path.join(
  process.cwd(),
  ".cache",
  "variational-last-quotes.json"
);

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

function releaseSharedSession(session?: http2.ClientHttp2Session | null) {
  const target = session || sharedH2Session;
  if (!target) return;
  if (sharedH2Session === target) {
    sharedH2Session = null;
  }
  try {
    if (!target.closed && !target.destroyed) {
      target.close();
    }
  } catch {
    // ignore
  }
}

function getH2Session(forceNew = false): http2.ClientHttp2Session {
  if (forceNew && sharedH2Session) {
    releaseSharedSession(sharedH2Session);
  }
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
    if (sharedH2Session === session) sharedH2Session = null;
  });
  session.on("close", () => {
    if (sharedH2Session === session) sharedH2Session = null;
  });
  session.on("goaway", () => releaseSharedSession(session));
  session.setTimeout(30_000, () => releaseSharedSession(session));
  sharedH2Session = session;
  return session;
}

function h2RequestTextOnce(
  method: "GET" | "POST",
  path: string,
  bodyObj?: Record<string, any>,
  underlying: string = "XAU",
  timeoutMs: number = 8_000,
  forceNewSession: boolean = false,
  keepErrorBody: boolean = false
): Promise<{ status: number; text: string | null }> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (status: number, text: string | null) => {
      if (settled) return;
      settled = true;
      resolve({ status, text });
    };

    let client: http2.ClientHttp2Session;
    try {
      client = getH2Session(forceNewSession);
    } catch {
      return finish(0, null);
    }

    let req: http2.ClientHttp2Stream | null = null;
    const timer = setTimeout(() => {
      try {
        req?.close();
      } catch {
        // ignore
      }
      finish(0, null);
    }, timeoutMs);

    const bodyStr = bodyObj ? JSON.stringify(bodyObj) : "";
    const isSwap = bodyObj?.instrument?.instrument_type === "swap";
    const refererRoute = isSwap ? "swap" : "perpetual";
    const headers: http2.OutgoingHttpHeaders = {
      ":method": method,
      ":path": path,
      ":authority": "omni.variational.io",
      ":scheme": "https",
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.9",
      origin: BASE,
      referer: `${BASE}/${refererRoute}/${underlying}`,
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
      req = client.request(headers);
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
          return finish(status, keepErrorBody && raw ? raw : null);
        }
        finish(status, raw);
      });
      req.on("error", () => {
        clearTimeout(timer);
        releaseSharedSession(client);
        finish(0, null);
      });

      if (method === "POST" && bodyStr) {
        req.write(bodyStr);
      }
      req.end();
    } catch {
      clearTimeout(timer);
      releaseSharedSession(client);
      finish(0, null);
    }
  });
}

async function h2RequestText(
  method: "GET" | "POST",
  path: string,
  bodyObj?: Record<string, any>,
  underlying: string = "XAU",
  timeoutMs: number = 8_000
): Promise<string | null> {
  const first = await h2RequestTextOnce(
    method,
    path,
    bodyObj,
    underlying,
    timeoutMs,
    false
  );
  if (first.text !== null) return first.text;
  if (first.status === 429) {
    await new Promise((r) => setTimeout(r, 600));
    const retry = await h2RequestTextOnce(
      method,
      path,
      bodyObj,
      underlying,
      timeoutMs,
      false
    );
    return retry.text;
  }
  if (first.status > 0) return null;
  const second = await h2RequestTextOnce(
    method,
    path,
    bodyObj,
    underlying,
    timeoutMs,
    true
  );
  return second.text;
}

async function h2PostQuote(
  body: Record<string, any>,
  underlying: string
): Promise<{ data: Record<string, any> | null; closed: boolean }> {
  const interpret = (
    status: number,
    text: string | null
  ): { data: Record<string, any> | null; closed: boolean } => {
    const closed =
      status === 422 && !!text && text.includes("market_status_refused");
    if (status === 200 && text) {
      try {
        return { data: JSON.parse(text), closed: false };
      } catch {
        return { data: null, closed: false };
      }
    }
    return { data: null, closed };
  };

  const first = await h2RequestTextOnce(
    "POST",
    "/api/quotes/simple",
    body,
    underlying,
    8_000,
    false,
    true
  );
  if (first.status === 200 || first.status === 422) {
    return interpret(first.status, first.text);
  }
  if (first.status === 429) {
    await new Promise((r) => setTimeout(r, 600));
    const retry = await h2RequestTextOnce(
      "POST",
      "/api/quotes/simple",
      body,
      underlying,
      8_000,
      false,
      true
    );
    return interpret(retry.status, retry.text);
  }
  if (first.status > 0) return interpret(first.status, first.text);
  const second = await h2RequestTextOnce(
    "POST",
    "/api/quotes/simple",
    body,
    underlying,
    8_000,
    true,
    true
  );
  return interpret(second.status, second.text);
}

async function h2RequestJson(
  method: "GET" | "POST",
  path: string,
  bodyObj?: Record<string, any>,
  underlying: string = "XAU",
  timeoutMs: number = 8_000
): Promise<Record<string, any> | null> {
  const text = await h2RequestText(method, path, bodyObj, underlying, timeoutMs);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export interface VariationalSpec {
  underlying: string;
  instrument_type: string;
  kind: string;
  funding_interval_s?: number;
}

interface RefMarkEntry {
  mark: number;
  index: number | null;
  marketStatus?: string | null;
  ts: number;
}

interface VariationalAppConfig {
  swapDefault: number | null;
  tradfiDefault: number | null;
  perpDefault: number | null;
  equityOverrides: Record<string, number>;
  takerFeeBps: number | null;
}

const CONFIG_TTL_MS = 600_000;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findExportLocal(text: string, alias: string): string | null {
  const m = text.match(new RegExp(`(\\w+) as ${escapeRegex(alias)}\\b`));
  return m ? m[1] : null;
}

function findImportSource(
  text: string,
  alias: string,
  currentPath: string
): [string | null, string | null] {
  const re = /import\{([^}]*)\}from"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const local = findExportLocal(m[1], alias);
    if (local) {
      const resolved = new URL(m[2], BASE + currentPath).pathname;
      return [local, resolved];
    }
  }
  return [null, null];
}

async function resolveNumericConst(
  text: string,
  varName: string,
  currentPath: string
): Promise<number | null> {
  const esc = escapeRegex(varName);
  const loc = text.match(
    new RegExp(`(?:\\b|[,;{}])${esc}=("?)(\\d+(?:\\.\\d+)?)\\1`)
  );
  if (loc) return Number(loc[2]);
  const [expName, srcPath] = findImportSource(text, varName, currentPath);
  if (srcPath && expName) {
    const st = await h2RequestText("GET", srcPath);
    if (st) {
      const localName = findExportLocal(st, expName);
      if (localName) {
        const escLocal = escapeRegex(localName);
        const vm = st.match(
          new RegExp(`(?:\\b|[,;{}])${escLocal}=("?)(\\d+(?:\\.\\d+)?)\\1`)
        );
        if (vm) return Number(vm[2]);
      }
    }
  }
  return null;
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
    AAPL: { underlying: "AAPL", instrument_type: "perpetual_rwa_future", kind: "equity" },
    MSFT: { underlying: "MSFT", instrument_type: "perpetual_rwa_future", kind: "equity" },
    GOOG: { underlying: "GOOGL", instrument_type: "perpetual_rwa_future", kind: "equity" },
    AMZN: { underlying: "AMZN", instrument_type: "perpetual_rwa_future", kind: "equity" },
    META: { underlying: "META", instrument_type: "perpetual_rwa_future", kind: "equity" },
    HOOD: { underlying: "HOOD", instrument_type: "perpetual_rwa_future", kind: "equity" },
    BABA: { underlying: "BABA", instrument_type: "perpetual_rwa_future", kind: "equity" },
    BB: { underlying: "BBX", instrument_type: "perpetual_rwa_future", kind: "equity" },
    PLTR: { underlying: "PLTR", instrument_type: "perpetual_rwa_future", kind: "equity" },
    AVGO: { underlying: "AVGO", instrument_type: "perpetual_rwa_future", kind: "equity" },
    NFLX: { underlying: "NFLX", instrument_type: "perpetual_rwa_future", kind: "equity" },
    CRWV: { underlying: "CRWV", instrument_type: "perpetual_rwa_future", kind: "equity" },
    STX: { underlying: "STXX", instrument_type: "perpetual_rwa_future", kind: "equity" },
    ASTS: { underlying: "ASTS", instrument_type: "perpetual_rwa_future", kind: "equity" },
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

  static readonly VARIATIONAL_SWAP_INSTRUMENTS: Record<string, VariationalSpec> = {
    // Commodities (Swaps on Omni)
    XAU: { underlying: "XAUS", instrument_type: "swap", kind: "commodity", funding_interval_s: 0 },
    XAG: { underlying: "XAGS", instrument_type: "swap", kind: "commodity", funding_interval_s: 0 },
    WTI: { underlying: "USOILP", instrument_type: "swap", kind: "commodity", funding_interval_s: 0 },
    BRENT: { underlying: "UKOILP", instrument_type: "swap", kind: "commodity", funding_interval_s: 0 },
    COPPER: { underlying: "COPPP", instrument_type: "swap", kind: "commodity", funding_interval_s: 0 },
    // Indices (Swaps on Omni)
    US500: { underlying: "US500S", instrument_type: "swap", kind: "index", funding_interval_s: 0 },
    US100: { underlying: "US100S", instrument_type: "swap", kind: "index", funding_interval_s: 0 },
  };

  static readonly VARIATIONAL_SYMBOLS: Record<string, string> = Object.fromEntries(
    Object.entries(VariationalAPI.VARIATIONAL_INSTRUMENTS).map(([k, spec]) => [
      k,
      spec.underlying,
    ])
  );

  static readonly VARIATIONAL_SWAP_SYMBOLS: Record<string, string> = Object.fromEntries(
    Object.entries(VariationalAPI.VARIATIONAL_SWAP_INSTRUMENTS).map(([k, spec]) => [
      k,
      spec.underlying,
    ])
  );

  private markCache: Record<string, RefMarkEntry> = {};
  private quoteCache: Record<string, { data: Record<string, any>; ts: number }> = {};
  private lastExecutable: Record<string, Record<string, any>> = {};
  private refusedClosed = new Set<string>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.loadLastQuotes();
  }
  private quoteInFlight: Record<
    string,
    Promise<Record<string, any> | null> | undefined
  > = {};
  private quoteQueue: Promise<unknown> = Promise.resolve();
  private bulkMarkLoadedAt = 0;
  private bulkMarkInFlight: Promise<void> | null = null;
  private appConfigCache: { data: VariationalAppConfig | null; ts: number } = {
    data: null,
    ts: 0,
  };
  private appConfigInFlight: Promise<VariationalAppConfig | null> | null = null;

  private async fetchTakerFeeBps(): Promise<number | null> {
    const data = await h2RequestJson("GET", "/api/metadata/config");
    const raw = data?.futures_taker_fee;
    if (raw == null) return null;
    const fee = Number(raw) * 10_000;
    return Number.isFinite(fee) ? fee : null;
  }

  private async loadAppConfig(): Promise<VariationalAppConfig | null> {
    const [feeFromApi, html] = await Promise.all([
      this.fetchTakerFeeBps(),
      h2RequestText("GET", "/perpetual/XAU"),
    ]);

    let takerFeeBps = feeFromApi;
    let swapDefault: number | null = null;
    let tradfiDefault: number | null = null;
    let perpDefault: number | null = null;
    const equityOverrides: Record<string, number> = {};

    if (html) {
      const entries = Array.from(
        html.matchAll(/\/_app\/immutable\/entry\/[A-Za-z0-9_.-]+\.js/g)
      ).map((m) => m[0]);

      const seen = new Set<string>();
      const queue: string[] = [...entries];

      while (queue.length > 0 && seen.size < 160) {
        const batch: string[] = [];
        while (queue.length > 0 && batch.length < 6) {
          const next = queue.shift()!;
          if (!seen.has(next)) {
            seen.add(next);
            batch.push(next);
          }
        }
        if (batch.length === 0) break;

        const texts = await Promise.all(
          batch.map(async (p) => [p, await h2RequestText("GET", p)] as const)
        );

        for (const [p, text] of texts) {
          if (!text) continue;

          for (const om of Array.from(
            text.matchAll(/(\w+):\{[^}]*max_leverage:"(\d+)"/g)
          )) {
            equityOverrides[om[1].toUpperCase()] = Number(om[2]);
          }

          if (takerFeeBps === null) {
            const fm = text.match(/futures_taker_fee:"?(\d+(?:\.\d+)?)"?/);
            if (fm) takerFeeBps = Number(fm[1]) * 10_000;
          }

          if (swapDefault === null || tradfiDefault === null || perpDefault === null) {
            const m = text.match(
              /\.symbol\)&&\w+\(\w+\.symbol\);return \w+\|\|\(\w+\(\w+\)\?(\w+):\w+&&\w+\(\w+\)\?(\w+):(\w+)\)\}/
            );
            if (m) {
              const [sDef, tDef, pDef] = await Promise.all([
                resolveNumericConst(text, m[1], p),
                resolveNumericConst(text, m[2], p),
                resolveNumericConst(text, m[3], p),
              ]);
              if (sDef !== null) swapDefault = sDef;
              if (tDef !== null) tradfiDefault = tDef;
              if (pDef !== null) perpDefault = pDef;
            }
          }

          for (const rel of Array.from(
            text.matchAll(/(?:from|import\(|")\s*["']([^"']+\.js)["']/g)
          )) {
            const nextP = new URL(rel[1], BASE + p).pathname;
            if (!seen.has(nextP)) queue.push(nextP);
          }
        }

        if (
          swapDefault !== null &&
          tradfiDefault !== null &&
          perpDefault !== null &&
          takerFeeBps !== null
        ) {
          break;
        }
      }
    }

    if (
      swapDefault === null &&
      tradfiDefault === null &&
      perpDefault === null &&
      takerFeeBps === null
    ) {
      return null;
    }

    return {
      swapDefault,
      tradfiDefault,
      perpDefault,
      equityOverrides,
      takerFeeBps,
    };
  }

  private async getAppConfigCached(): Promise<VariationalAppConfig | null> {
    if (
      this.appConfigCache.data &&
      Date.now() - this.appConfigCache.ts < CONFIG_TTL_MS
    ) {
      return this.appConfigCache.data;
    }
    if (this.appConfigInFlight) {
      return this.appConfigInFlight;
    }
    this.appConfigInFlight = (async () => {
      try {
        const cfg = await this.loadAppConfig();
        if (cfg) {
          this.appConfigCache = { data: cfg, ts: Date.now() };
        }
        return this.appConfigCache.data;
      } finally {
        this.appConfigInFlight = null;
      }
    })();
    return this.appConfigInFlight;
  }

  private maxLeverageFromConfig(
    spec: VariationalSpec,
    cfg: VariationalAppConfig | null
  ): number | null {
    if (!cfg) return null;
    const sym = spec.underlying.toUpperCase();
    if (sym in cfg.equityOverrides) {
      return floorLeverage(cfg.equityOverrides[sym]);
    }
    if (spec.instrument_type === "swap" || spec.instrument_type === "perpetual_cfd") {
      return floorLeverage(cfg.swapDefault);
    }
    return floorLeverage(cfg.perpDefault ?? cfg.tradfiDefault);
  }

  async fetchQuoteForSpec(
    spec: VariationalSpec,
    qty: number,
    cacheKeyHint?: string
  ): Promise<Record<string, any> | null> {
    const underlying = spec.underlying;
    const cacheKey = cacheKeyHint || `${underlying.toUpperCase()}:${qty.toPrecision(4)}`;
    const now = Date.now();
    const cached = this.quoteCache[cacheKey];
    if (cached && now - cached.ts < 12_000) {
      return cached.data;
    }
    if (this.quoteInFlight[cacheKey]) {
      return this.quoteInFlight[cacheKey];
    }

    const body = {
      instrument: { settlement_asset: SETTLEMENT_ASSET, ...spec },
      qty: String(qty),
    };

    const run = (async () => {
      try {
        const prev = this.quoteQueue;
        let release!: () => void;
        this.quoteQueue = new Promise<void>((r) => {
          release = r;
        });
        await prev;
        try {
          const { data, closed } = await h2PostQuote(body, underlying);
          if (closed) {
            this.refusedClosed.add(underlying.toUpperCase());
            return null;
          }
          if (data && data.bid != null && data.ask != null) {
            this.refusedClosed.delete(underlying.toUpperCase());
            this.quoteCache[cacheKey] = { data, ts: Date.now() };
            await new Promise((r) => setTimeout(r, 200));
            return data;
          }
          if (cached && Date.now() - cached.ts < 120_000) {
            return cached.data;
          }
          return null;
        } finally {
          release();
        }
      } finally {
        delete this.quoteInFlight[cacheKey];
      }
    })();

    this.quoteInFlight[cacheKey] = run;
    return run;
  }

  async fetchQuote(
    assetKey: string,
    qty: number
  ): Promise<Record<string, any> | null> {
    const spec = VariationalAPI.VARIATIONAL_INSTRUMENTS[assetKey.toUpperCase()];
    if (!spec) return null;
    return this.fetchQuoteForSpec(spec, qty);
  }

  async fetchSwapQuote(
    assetKey: string,
    qty: number
  ): Promise<Record<string, any> | null> {
    const spec =
      VariationalAPI.VARIATIONAL_SWAP_INSTRUMENTS[assetKey.toUpperCase()];
    if (!spec) return null;
    return this.fetchQuoteForSpec(spec, qty);
  }

  private async loadBulkSupportedAssetsMarks(): Promise<void> {
    if (
      Date.now() - this.bulkMarkLoadedAt < 15_000 &&
      Object.keys(this.markCache).length > 0
    ) {
      return;
    }
    if (this.bulkMarkInFlight) {
      return this.bulkMarkInFlight;
    }
    this.bulkMarkInFlight = (async () => {
      try {
        const data = await h2RequestJson("GET", "/api/metadata/supported_assets");
        if (!data || typeof data !== "object") return;
        const now = Date.now();
        const allSpecs = [
          ...Object.entries(VariationalAPI.VARIATIONAL_INSTRUMENTS),
          ...Object.entries(VariationalAPI.VARIATIONAL_SWAP_INSTRUMENTS),
        ];
        for (const [assetKey, spec] of allSpecs) {
          const rawList = data[spec.underlying] || data[assetKey];
          const rec = Array.isArray(rawList) ? rawList[0] : rawList;
          if (!rec || typeof rec !== "object") continue;
          const mark = Number(rec.price);
          const index =
            rec.index_price != null ? Number(rec.index_price) : null;
          const marketStatus =
            typeof rec.market_status === "string" ? rec.market_status : null;
          if (Number.isFinite(mark) && mark > 0) {
            this.markCache[spec.underlying.toUpperCase()] = {
              mark,
              index: Number.isFinite(index) ? index : null,
              marketStatus,
              ts: now,
            };
          }
        }
        this.bulkMarkLoadedAt = now;
      } finally {
        this.bulkMarkInFlight = null;
      }
    })();
    return this.bulkMarkInFlight;
  }

  private async referenceMarkForSpec(
    spec: VariationalSpec
  ): Promise<RefMarkEntry | null> {
    const cacheKey = spec.underlying.toUpperCase();
    const cached = this.markCache[cacheKey];
    if (cached && Date.now() - cached.ts < 15_000) {
      return cached;
    }
    await this.loadBulkSupportedAssetsMarks();
    if (
      this.markCache[cacheKey] &&
      Date.now() - this.markCache[cacheKey].ts < 15_000
    ) {
      return this.markCache[cacheKey];
    }
    const q = await this.fetchQuoteForSpec(spec, REF_QTY);
    if (!q) return cached || null;
    const mark = Number(q.mark_price);
    const index = q.index_price != null ? Number(q.index_price) : null;
    if (Number.isFinite(mark) && mark > 0) {
      const entry: RefMarkEntry = {
        mark,
        index: Number.isFinite(index) ? index : null,
        ts: Date.now(),
      };
      this.markCache[cacheKey] = entry;
      return entry;
    }
    return cached || null;
  }

  private quoteCacheKey(spec: VariationalSpec, orderSizeUsd: number): string {
    return `${spec.underlying.toUpperCase()}:usd:${Math.round(orderSizeUsd)}`;
  }

  private loadLastQuotes(): void {
    try {
      const raw = fs.readFileSync(LAST_QUOTE_PATH, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        this.lastExecutable = parsed;
      }
    } catch {
      this.lastExecutable = {};
    }
  }

  private schedulePersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      try {
        fs.mkdirSync(path.dirname(LAST_QUOTE_PATH), { recursive: true });
        const tmp = `${LAST_QUOTE_PATH}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(this.lastExecutable));
        fs.renameSync(tmp, LAST_QUOTE_PATH);
      } catch {
        // Memory cache still serves this process if the disk write fails.
      }
    }, 250);
  }

  private rememberQuote(key: string, result: Record<string, any>): void {
    const stored = { ...result };
    delete stored.market_status;
    delete stored.quote_stale;
    stored.quoted_at = stored.timestamp;
    this.lastExecutable[key] = stored;
    this.schedulePersist();
  }

  private replayClosed(
    key: string,
    isLong: boolean,
    cfg: VariationalAppConfig | null
  ): Record<string, any> | null {
    const last = this.lastExecutable[key];
    if (!last) return null;
    const buy = Number(last.buy_slippage_bps);
    const sell = Number(last.sell_slippage_bps);
    if (!Number.isFinite(buy) || !Number.isFinite(sell)) return null;

    const out = { ...last };
    out.opening_slippage_bps = isLong ? buy : sell;
    out.closing_slippage_bps = isLong ? sell : buy;
    out.slippage_bps = (buy + sell) / 2;
    out.is_long = isLong;
    const fee =
      cfg?.takerFeeBps != null && Number.isFinite(cfg.takerFeeBps)
        ? cfg.takerFeeBps
        : Number(out.fee_bps);
    if (Number.isFinite(fee)) {
      out.open_fee_bps = fee;
      out.close_fee_bps = fee;
      out.fee_bps = fee;
      out.maker_fee_bps = fee;
      out.total_cost_bps = buy + sell + 2 * fee;
    }
    if (out.quoted_at != null) out.timestamp = out.quoted_at;
    out.market_status = "closed";
    out.quote_stale = true;
    out.executed = "CLOSED";
    return out;
  }

  public async calculateCostForSpec(
    spec: VariationalSpec,
    display: string,
    orderSizeUsd: number,
    isLong: boolean
  ): Promise<Record<string, any> | null> {
    const [refEntry, cfg] = await Promise.all([
      this.referenceMarkForSpec(spec),
      this.getAppConfigCached(),
    ]);
    const quoteCacheKey = this.quoteCacheKey(spec, orderSizeUsd);
    if (refEntry?.marketStatus === "closed") {
      return this.replayClosed(quoteCacheKey, isLong, cfg);
    }
    if (
      !refEntry ||
      refEntry.mark <= 0 ||
      !cfg ||
      cfg.takerFeeBps === null
    ) {
      return null;
    }

    const qty = orderSizeUsd / refEntry.mark;
    if (qty <= 0) return null;

    const quote = await this.fetchQuoteForSpec(spec, qty, quoteCacheKey);
    if (!quote) {
      if (this.refusedClosed.has(spec.underlying.toUpperCase())) {
        return this.replayClosed(quoteCacheKey, isLong, cfg);
      }
      return null;
    }

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

    // Anchor per-side slippage to the unshifted top-of-book mark price (scaled by live index movement),
    // matching Variational's UI formula: (ask - refMark)/refMark for Long, (refMark - bid)/refMark for Short.
    const rawAnchor =
      refEntry.index &&
      refEntry.index > 0 &&
      indexPrice &&
      Number.isFinite(indexPrice) &&
      indexPrice > 0
        ? refEntry.mark * (indexPrice / refEntry.index)
        : refEntry.mark;
    const anchorMid =
      rawAnchor > bid && rawAnchor < ask ? rawAnchor : markPrice;
    if (anchorMid <= 0) return null;

    const buySlipBps = ((ask - anchorMid) / anchorMid) * 10000;
    const sellSlipBps = ((anchorMid - bid) / anchorMid) * 10000;
    const avgSlipBps = (buySlipBps + sellSlipBps) / 2;
    const spreadBps = ((ask - bid) / anchorMid) * 10000;

    const openingSlip = isLong ? buySlipBps : sellSlipBps;
    const closingSlip = isLong ? sellSlipBps : buySlipBps;

    const feeBps = cfg.takerFeeBps;
    const maxLev = this.maxLeverageFromConfig(spec, cfg);
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

    const result = {
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
    this.rememberQuote(quoteCacheKey, result);
    return result;
  }

  async calculateCost(
    assetKey: string,
    orderSizeUsd: number,
    isLong: boolean = true
  ): Promise<Record<string, any> | null> {
    const key = assetKey.toUpperCase();
    const spec = VariationalAPI.VARIATIONAL_INSTRUMENTS[key];
    if (!spec) return null;
    const display = VariationalAPI.VARIATIONAL_SYMBOLS[key] || key;
    return this.calculateCostForSpec(spec, display, orderSizeUsd, isLong);
  }

  async calculateSwapCost(
    assetKey: string,
    orderSizeUsd: number,
    isLong: boolean = true
  ): Promise<Record<string, any> | null> {
    const key = assetKey.toUpperCase();
    const spec = VariationalAPI.VARIATIONAL_SWAP_INSTRUMENTS[key];
    if (!spec) return null;
    const display = VariationalAPI.VARIATIONAL_SWAP_SYMBOLS[key] || key;
    return this.calculateCostForSpec(spec, display, orderSizeUsd, isLong);
  }
}
