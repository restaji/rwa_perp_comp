import {
  ExecutionCalculator,
  floorLeverage,
  HYPERLIQUID_GROWTH_MODE_SCALE,
  HYPERLIQUID_NO_GROWTH_MODE_SCALE,
  OrderbookLevel,
  StandardizedOrderbook,
} from "../models";

const BASE_URL = "https://api.hyperliquid.xyz/info";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000001";
const CACHE_TTL_MS = 300_000;

export class HyperliquidAPI {
  private maxLeveragesCache: Record<string, any> = {};
  private growthModeCache: Record<string, boolean> = {};
  private feeCache: Record<string, [number | null, number | null]> = {};
  private fundingCache: Record<string, number> = {};
  private deployerFeeScaleCache: Record<string, number> = {};

  private deployerFeeScale: number | null = null;
  private baseTakerRate: number | null = null;
  private baseMakerRate: number | null = null;

  private flxDeployerFeeScale: number | null = null;
  private flxBaseTakerRate: number | null = null;
  private flxBaseMakerRate: number | null = null;

  private lastMetadataFetch = 0;
  private lastFeeFetch = 0;

  private isFlxSymbol(symbol: string): boolean {
    return symbol.startsWith("flx:");
  }

  private resolveFlxCoin(symbol: string): string {
    const plain = symbol.startsWith("flx:") ? symbol.replace("flx:", "") : symbol;
    return `flx:${plain}`;
  }

  private async postInfo(payload: Record<string, any>): Promise<any> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(BASE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
        if (res.status === 429 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
          continue;
        }
        if (!res.ok) return null;
        return res.json();
      } catch {
        if (attempt === 2) return null;
      }
    }
    return null;
  }

  private async fetchFeeConfig(): Promise<void> {
    if (
      Date.now() - this.lastFeeFetch < CACHE_TTL_MS &&
      this.baseTakerRate !== null
    ) {
      return;
    }
    try {
      const [dexes, xyzFees, flxFees] = await Promise.all([
        this.postInfo({ type: "perpDexs" }),
        this.postInfo({ type: "userFees", user: ZERO_ADDRESS, dex: "xyz" }),
        this.postInfo({ type: "userFees", user: ZERO_ADDRESS, dex: "flx" }),
      ]);

      for (const dex of dexes || []) {
        if (!dex || dex.deployerFeeScale == null) continue;
        const scale = Number(dex.deployerFeeScale);
        if (dex.name === "xyz") this.deployerFeeScale = scale;
        else if (dex.name === "flx") this.flxDeployerFeeScale = scale;
      }

      if (xyzFees && typeof xyzFees === "object") {
        if (xyzFees.userCrossRate != null)
          this.baseTakerRate = Number(xyzFees.userCrossRate);
        if (xyzFees.userAddRate != null)
          this.baseMakerRate = Number(xyzFees.userAddRate);
      }

      if (flxFees && typeof flxFees === "object") {
        if (flxFees.userCrossRate != null)
          this.flxBaseTakerRate = Number(flxFees.userCrossRate);
        if (flxFees.userAddRate != null)
          this.flxBaseMakerRate = Number(flxFees.userAddRate);
      }

      this.lastFeeFetch = Date.now();
    } catch {
      // ignore
    }
  }

  private parseMetaPayload(data: any): [any[], any[]] {
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
      const universe = data[0]?.universe || [];
      const assetCtxs = data.length > 1 ? data[1] : [];
      return [universe, assetCtxs];
    }
    if (data && typeof data === "object") {
      return [data.universe || [], []];
    }
    return [[], []];
  }

  private storeAssetMeta(dexName: string, item: any, funding1h: number): void {
    const name: string | undefined = item?.name;
    if (!name) return;
    const rawScale = Number(item.deployerFeeScale);
    const feeScale = Number.isFinite(rawScale) ? rawScale : null;
    const stripped = name.startsWith(`${dexName}:`)
      ? name.replace(`${dexName}:`, "")
      : name;
    const prefixed = name.startsWith(`${dexName}:`) ? name : `${dexName}:${name}`;

    for (const key of [name, stripped, prefixed]) {
      this.maxLeveragesCache[key] = item.maxLeverage;
      this.growthModeCache[key] = item.growthMode === "enabled";
      this.fundingCache[key] = funding1h;
      if (feeScale !== null) {
        this.deployerFeeScaleCache[key] = feeScale;
      }
    }
  }

  private async ingestDexMetadata(dexName: string): Promise<void> {
    const data = await this.postInfo({ type: "metaAndAssetCtxs", dex: dexName });
    if (!data) return;
    const [universe, assetCtxs] = this.parseMetaPayload(data);
    universe.forEach((item: any, i: number) => {
      const funding1h =
        i < assetCtxs.length ? Number(assetCtxs[i]?.funding || 0) : 0;
      this.storeAssetMeta(dexName, item, funding1h);
    });
  }

  private async fetchMetadata(): Promise<void> {
    if (
      Date.now() - this.lastMetadataFetch < CACHE_TTL_MS &&
      Object.keys(this.maxLeveragesCache).length > 0
    ) {
      return;
    }
    try {
      await Promise.all(["xyz", "flx"].map((d) => this.ingestDexMetadata(d)));
      if (Object.keys(this.maxLeveragesCache).length > 0) {
        this.lastMetadataFetch = Date.now();
      }
    } catch {
      // ignore
    }
  }

  private feeSymbolKeys(symbol: string): [boolean, string, string] {
    if (this.isFlxSymbol(symbol)) {
      const search = this.resolveFlxCoin(symbol);
      return [true, search, search.replace("flx:", "")];
    }
    const search = symbol.startsWith("xyz:") ? symbol : `xyz:${symbol}`;
    const plain = symbol.startsWith("xyz:") ? symbol.replace("xyz:", "") : symbol;
    return [false, search, plain];
  }

  async getFees(symbol: string): Promise<[number | null, number | null]> {
    await Promise.all([this.fetchFeeConfig(), this.fetchMetadata()]);

    const [isFlx, searchSymbol, plainSymbol] = this.feeSymbolKeys(symbol);
    if (this.feeCache[searchSymbol]) {
      return this.feeCache[searchSymbol];
    }

    const growthKnown =
      searchSymbol in this.growthModeCache || plainSymbol in this.growthModeCache;

    const assetScale =
      this.deployerFeeScaleCache[searchSymbol] ??
      this.deployerFeeScaleCache[plainSymbol] ??
      null;

    const deployerFeeScale = isFlx
      ? assetScale ?? this.flxDeployerFeeScale
      : assetScale ?? this.deployerFeeScale;
    const baseTaker = isFlx ? this.flxBaseTakerRate : this.baseTakerRate;
    const baseMaker = isFlx ? this.flxBaseMakerRate : this.baseMakerRate;

    const growthEnabled = growthKnown
      ? (this.growthModeCache[searchSymbol] ?? this.growthModeCache[plainSymbol])
      : null;

    if (
      !growthKnown ||
      growthEnabled == null ||
      baseTaker === null ||
      baseMaker === null ||
      deployerFeeScale === null
    ) {
      return [null, null];
    }

    const scaleIfHip3 =
      deployerFeeScale < 1 ? deployerFeeScale + 1 : deployerFeeScale * 2;
    const growthScale = growthEnabled
      ? HYPERLIQUID_GROWTH_MODE_SCALE
      : HYPERLIQUID_NO_GROWTH_MODE_SCALE;

    const takerFeeBps = baseTaker * 100 * scaleIfHip3 * growthScale * 100;
    const makerFeeBps = baseMaker * 100 * scaleIfHip3 * growthScale * 100;

    this.feeCache[searchSymbol] = [takerFeeBps, makerFeeBps];
    this.feeCache[plainSymbol] = [takerFeeBps, makerFeeBps];
    return [takerFeeBps, makerFeeBps];
  }

  async getMaxLeverage(symbol: string): Promise<number | null> {
    await this.fetchMetadata();
    if (this.isFlxSymbol(symbol)) {
      const key = this.resolveFlxCoin(symbol);
      return floorLeverage(this.maxLeveragesCache[key]);
    }
    return floorLeverage(this.maxLeveragesCache[`xyz:${symbol}`]);
  }

  private normalizeSymbol(symbol: string): string {
    if (symbol.startsWith("flx:")) return symbol;
    const s = symbol.toUpperCase();
    if (s === "NDX") return "kPW";
    return s;
  }

  private normalizeLevel(lvl: any): { px: string; sz: string } | null {
    if (lvl && typeof lvl === "object" && !Array.isArray(lvl)) {
      return { px: String(lvl.px), sz: String(lvl.sz) };
    }
    if (Array.isArray(lvl) && lvl.length >= 2) {
      return { px: String(lvl[0]), sz: String(lvl[1]) };
    }
    return null;
  }

  async getOrderbook(
    symbol: string,
    nSigFigs: number | null = null
  ): Promise<Record<string, any> | null> {
    const rawSymbol = this.normalizeSymbol(symbol);
    const coin = this.isFlxSymbol(rawSymbol)
      ? this.resolveFlxCoin(rawSymbol)
      : rawSymbol.startsWith("xyz:")
      ? rawSymbol
      : `xyz:${rawSymbol}`;

    const payload: Record<string, any> = { type: "l2Book", coin };
    if (nSigFigs !== null) payload.nSigFigs = nSigFigs;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(BASE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
        if (res.status === 429 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
        if (!res.ok) return null;
        const data = await res.json();
        const levels = data?.levels;
        if (!Array.isArray(levels) || levels.length < 2) return null;
        const bids = (Array.isArray(levels[0]) ? levels[0] : [])
          .map((b) => this.normalizeLevel(b))
          .filter(Boolean);
        const asks = (Array.isArray(levels[1]) ? levels[1] : [])
          .map((a) => this.normalizeLevel(a))
          .filter(Boolean);
        if (!bids.length || !asks.length) return null;
        return { levels: [bids, asks] };
      } catch {
        return null;
      }
    }
    return null;
  }

  normalizeOrderbook(orderbook: Record<string, any> | null): StandardizedOrderbook | null {
    if (!orderbook) return null;
    const levels = orderbook.levels || [[], []];
    const bids = levels[0] || [];
    const asks = levels[1] || [];
    if (!bids.length || !asks.length) return null;

    const bestBid = Number(orderbook.true_best_bid || bids[0]?.px || 0);
    const bestAsk = Number(orderbook.true_best_ask || asks[0]?.px || 0);
    if (bestBid <= 0 || bestAsk <= 0) return null;

    const parse = (entries: any[]): OrderbookLevel[] =>
      entries
        .map((e) => ({ price: Number(e?.px || 0), qty: Number(e?.sz || 0) }))
        .filter((e) => Number.isFinite(e.price) && Number.isFinite(e.qty));

    return {
      bids: parse(bids),
      asks: parse(asks),
      best_bid: bestBid,
      best_ask: bestAsk,
      mid_price: (bestBid + bestAsk) / 2,
      timestamp: Date.now() / 1000,
    };
  }

  private hlDisplaySymbol(symbol: string): string {
    if (this.isFlxSymbol(symbol)) {
      return symbol.startsWith("flx:") ? symbol : `flx:${symbol}`;
    }
    return symbol.includes("xyz") ? symbol : `xyz:${symbol}`;
  }

  async getOptimalExecution(
    symbol: string,
    orderSizeUsd: number
  ): Promise<Record<string, any> | null> {
    const [[takerFeeBps, makerFeeBps], rawDefault] = await Promise.all([
      this.getFees(symbol),
      this.getOrderbook(symbol, null),
    ]);
    if (takerFeeBps === null || !rawDefault) return null;

    const stdDefault = this.normalizeOrderbook(rawDefault);
    if (!stdDefault) return null;

    const result = ExecutionCalculator.calculateExecutionCost(
      stdDefault,
      orderSizeUsd,
      takerFeeBps,
      takerFeeBps
    );
    if (!result) return null;

    result.fee_bps = takerFeeBps;
    result.maker_fee_bps = makerFeeBps;
    result.sig_figs = "Maximum";
    result.is_xyz = !this.isFlxSymbol(symbol);
    result.symbol = this.hlDisplaySymbol(symbol);
    result.max_leverage = await this.getMaxLeverage(symbol);
    result.true_mid = stdDefault.mid_price;
    return result;
  }
}
