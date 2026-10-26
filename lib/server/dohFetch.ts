import https from "https";

interface DohEntry {
  ip: string;
  ts: number;
}

const dohCache = new Map<string, DohEntry>();
const inflightDoh = new Map<string, Promise<string>>();
const DOH_TTL_MS = 600_000;

async function resolveIPv4DoH(hostname: string): Promise<string> {
  const cached = dohCache.get(hostname);
  if (cached && Date.now() - cached.ts < DOH_TTL_MS) {
    return cached.ip;
  }

  const pending = inflightDoh.get(hostname);
  if (pending) return pending;

  const task = (async () => {
    for (const endpoint of [
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(
        hostname
      )}&type=A`,
      `https://dns.google/resolve?name=${encodeURIComponent(
        hostname
      )}&type=A`,
    ]) {
      try {
        const res = await fetch(endpoint, {
          headers: { Accept: "application/dns-json" },
          cache: "no-store",
        });
        if (!res.ok) continue;
        const data = await res.json();
        const ans = (data?.Answer || []).find(
          (a: any) => a?.type === 1 && typeof a?.data === "string"
        );
        if (ans) {
          dohCache.set(hostname, { ip: ans.data, ts: Date.now() });
          return ans.data as string;
        }
      } catch {
        // try next DoH provider
      }
    }
    throw new Error(`DoH lookup failed for ${hostname}`);
  })();

  inflightDoh.set(hostname, task);
  try {
    return await task;
  } finally {
    inflightDoh.delete(hostname);
  }
}

const dohAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 64,
  lookup: (hostname, options, cb) => {
    const wantAll =
      typeof options === "object" && options !== null && Boolean(options.all);
    resolveIPv4DoH(hostname)
      .then((ip) => {
        if (wantAll) {
          cb(null, [{ address: ip, family: 4 }] as any);
        } else {
          cb(null, ip, 4);
        }
      })
      .catch((err) => cb(err, "", 4));
  },
});

export function dohFetchText(
  urlStr: string,
  opts: {
    method?: "GET" | "POST";
    body?: Record<string, any>;
    headers?: Record<string, string>;
    timeoutMs?: number;
  } = {}
): Promise<string | null> {
  const u = new URL(urlStr);
  const method = opts.method || "GET";
  const bodyStr = opts.body ? JSON.stringify(opts.body) : "";
  const timeoutMs = opts.timeoutMs ?? 10_000;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (val: string | null) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };

    const headers: Record<string, string> = {
      Accept: "application/json, text/html, */*",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      ...(opts.headers || {}),
    };
    if (bodyStr) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = String(Buffer.byteLength(bodyStr));
    }

    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port ? Number(u.port) : 443,
        path: u.pathname + u.search,
        method,
        headers,
        agent: dohAgent,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const status = res.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            return finish(null);
          }
          try {
            finish(Buffer.concat(chunks).toString("utf8"));
          } catch {
            finish(null);
          }
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      finish(null);
    });
    req.on("error", () => finish(null));

    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

export async function dohFetchJson(
  urlStr: string,
  opts: {
    method?: "GET" | "POST";
    body?: Record<string, any>;
    headers?: Record<string, string>;
    timeoutMs?: number;
  } = {}
): Promise<any | null> {
  const text = await dohFetchText(urlStr, opts);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
