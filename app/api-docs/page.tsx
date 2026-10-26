"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Copy, Check, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/lib/api";

const NAV_SECTIONS = [
  { id: "introduction", label: "Introduction" },
  { id: "base-url", label: "Base URL" },
  { id: "authentication", label: "Authentication" },
  { id: "endpoints", label: "Endpoints" },
  { id: "compare", label: "Compare Costs", indent: true },
  { id: "request", label: "Request Parameters", indent: true },
  { id: "response", label: "Response Schema", indent: true },
  { id: "exchange-fields", label: "Exchange Fields", indent: true },
  { id: "examples", label: "Examples" },
  { id: "errors", label: "Error Handling" },
  { id: "assets", label: "Supported Assets" },
  { id: "rate-limits", label: "Rate Limits" },
];

export default function APIDocsPage() {
  const [activeSection, setActiveSection] = useState("introduction");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [origin, setOrigin] = useState("https://realworldperps.xyz");

  React.useEffect(() => {
    if (typeof window !== "undefined" && window.location.origin) {
      setOrigin(window.location.origin);
    }
  }, []);

  const baseUrl = API_BASE || origin;

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: "url(/bg-texture.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.15,
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, rgba(10,10,10,0.8) 100%)",
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md border-b border-white/5 bg-[#0A0A0A]/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/" 
                className="flex items-center gap-2 text-[#888] hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Back</span>
              </Link>
              <div className="h-4 w-px bg-white/10" />
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#D8F213]" />
                <span className="font-light text-white">API Reference</span>
              </div>
            </div>
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.svg" alt="Real World Perps" className="h-8 w-auto" />
              <span className="font-light text-white text-sm">Real World Perps</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex gap-12">
          {/* Sidebar Navigation */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <nav className="sticky top-28 space-y-1">
              {NAV_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors",
                    section.indent && "pl-6",
                    activeSection === section.id
                      ? "bg-white/5 text-white"
                      : "text-[#666] hover:text-white hover:bg-white/[0.02]"
                  )}
                >
                  {section.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Hero */}
            <div className="mb-16">
              <div className="flex items-center gap-3 mb-4">
                <h1 className="text-4xl font-light text-white">API Reference</h1>
                <span className="text-xs bg-[#D8F213]/20 text-[#D8F213] px-2 py-1 rounded-full">v1</span>
              </div>
              <p className="text-lg text-[#888] max-w-2xl">
                Integrate real-world asset execution cost comparison into your application. 
                Query live data from multiple perpetual DEXs with a single API call.
              </p>
            </div>

            {/* Introduction */}
            <Section id="introduction" title="Introduction">
              <p>
                The Real World Perps API provides programmatic access to execution cost comparisons 
                across multiple perpetual DEXs. Use it to find the best venue for trading real-world 
                assets like gold, forex, and equities.
              </p>
              <p>
                The API returns real-time data including slippage estimates, fee calculations, 
                liquidity checks, and identifies the lowest-cost venue for your trade parameters.
              </p>
            </Section>

            {/* Base URL */}
            <Section id="base-url" title="Base URL">
              <p>
                All API requests should be made to the following base URL:
              </p>
              <CodeBlock 
                id="base-url-code"
                code={baseUrl}
                copyToClipboard={copyToClipboard}
                copiedId={copiedId}
              />
            </Section>

            {/* Authentication */}
            <Section id="authentication" title="Authentication">
              <p>
                The API is currently open and does not require authentication. 
                This may change in the future for rate limiting purposes.
              </p>
              <CodeBlock 
                id="auth-code"
                language="bash"
                code={`# No authentication required
curl "${baseUrl}/api/compare/XAU?size=100000&direction=long"`}
                copyToClipboard={copyToClipboard}
                copiedId={copiedId}
              />
            </Section>

            {/* Endpoints */}
            <Section id="endpoints" title="Endpoints">
              <p>
                The API currently provides one main endpoint for comparing execution costs 
                across all supported exchanges.
              </p>
            </Section>

            {/* Compare Endpoint */}
            <Section id="compare" title="Compare Costs">
              <EndpointHeader method="GET" path="/api/compare/{asset}" />
              <p>
                Compare execution costs for a specific asset across all supported perpetual DEXs. 
                Returns real-time slippage, fees, and liquidity data for each exchange.
              </p>
            </Section>

            {/* Request Parameters */}
            <Section id="request" title="Request Parameters">
              <h3 className="text-lg font-medium text-white mt-6 mb-4">Path Parameters</h3>
              <ParamTable params={[
                { 
                  name: "asset", 
                  type: "string", 
                  required: true, 
                  description: "Asset identifier (e.g., XAU, XAG, EURUSD, AAPL)" 
                },
              ]} />

              <h3 className="text-lg font-medium text-white mt-8 mb-4">Query Parameters</h3>
              <ParamTable params={[
                { 
                  name: "size", 
                  type: "number", 
                  required: true, 
                  description: "Order size in USD (e.g., 100000 for $100,000)" 
                },
                { 
                  name: "direction", 
                  type: "string", 
                  required: true, 
                  description: "Trade direction: \"long\" or \"short\"" 
                },
                { 
                  name: "order_type", 
                  type: "string", 
                  required: false, 
                  description: "Order type: \"taker\" (default) or \"maker\"" 
                },
              ]} />

              <h3 className="text-lg font-medium text-white mt-8 mb-4">Example Request</h3>
              <CodeBlock 
                id="example-request"
                language="bash"
                code={`curl "${baseUrl}/api/compare/XAU?size=100000&direction=long&order_type=taker"`}
                copyToClipboard={copyToClipboard}
                copiedId={copiedId}
              />
            </Section>

            {/* Response Schema */}
            <Section id="response" title="Response Schema">
              <p>
                The response contains metadata about the request, results from each exchange, 
                and the winning (lowest cost) venue.
              </p>

              <h3 className="text-lg font-medium text-white mt-6 mb-4">Top-Level Fields</h3>
              <ParamTable params={[
                { name: "asset", type: "string", description: "Full asset name (e.g., \"XAU/USD\")" },
                { name: "symbol_key", type: "string", description: "Asset identifier used in request" },
                { name: "order_size_usd", type: "number", description: "Requested order size in USD" },
                { name: "order_type", type: "string", description: "Order type (taker/maker)" },
                { name: "direction", type: "string", description: "Trade direction (long/short)" },
                { name: "winner", type: "string", description: "Exchange with lowest total cost" },
                { name: "winner_cost_bps", type: "number", description: "Winning exchange total cost in bps" },
                { name: "symbols", type: "object", description: "Asset symbol mapping for each exchange" },
                { name: "hyperliquid", type: "object | null", description: "Hyperliquid exchange result" },
                { name: "lighter", type: "object | null", description: "Lighter exchange result" },
                { name: "aster", type: "object | null", description: "Aster exchange result" },
                { name: "veranta", type: "object | null", description: "Veranta exchange result" },
                { name: "extended", type: "object | null", description: "Extended exchange result" },
                { name: "edgex", type: "object | null", description: "EdgeX exchange result" },
                { name: "grvt", type: "object | null", description: "GRVT exchange result" },
                { name: "variational", type: "object | null", description: "Variational (Perp) exchange result — commodities, indices, and US equities/ETFs; null when no live quote" },
                { name: "variational_swap", type: "object | null", description: "Variational (Swap) exchange result — zero-funding swaps on commodities (XAUS, XAGS, USOILP, UKOILP) and indices (US500S, US100S)" },
                { name: "ondo", type: "object | null", description: "Ondo exchange result — commodities and US equities" },
                { name: "pacifica", type: "object | null", description: "Pacifica exchange result — commodities, select forex, and US equities" },
                { name: "risex", type: "object | null", description: "RISEx exchange result — commodities, indices, and US equities" },
                { name: "txflow", type: "object | null", description: "TxFlow exchange result — commodities, forex, indices, and US equities" },
              ]} />
            </Section>

            {/* Exchange Fields */}
            <Section id="exchange-fields" title="Exchange Fields">
              <p>
                Each exchange object contains the following fields. Some fields may be null 
                or absent if not applicable to that exchange.
              </p>

              <h3 className="text-lg font-medium text-white mt-6 mb-4">Cost Fields (in basis points)</h3>
              <ParamTable params={[
                { name: "opening_slippage_bps", type: "number", description: "Slippage cost when opening position" },
                { name: "closing_slippage_bps", type: "number", description: "Slippage cost when closing position" },
                { name: "open_fee_bps", type: "number", description: "Fee charged on open" },
                { name: "close_fee_bps", type: "number", description: "Fee charged on close" },
                { name: "total_cost_bps", type: "number", description: "Total round-trip cost" },
                { name: "effective_spread_bps", type: "number", description: "Effective bid-ask spread" },
              ]} />

              <h3 className="text-lg font-medium text-white mt-6 mb-4">Holding Fee Fields</h3>
              <p className="text-[#999] mb-4">
                Holding fees are based on the platform{"'"}s hourly funding/margin rate extrapolated to 24 hours. 
                Symmetric exchanges return a single rate; directional exchanges (Veranta, Ostium) return separate long/short rates.
              </p>
              <ParamTable params={[
                { name: "holding_fee_1h_pct", type: "number", description: "Hourly holding fee as % of notional (symmetric exchanges)" },
                { name: "holding_fee_24h_pct", type: "number", description: "24-hour holding fee as % of notional (symmetric exchanges)" },
                { name: "holding_fee_1h_long_pct", type: "number", description: "Hourly holding fee for longs (directional exchanges)" },
                { name: "holding_fee_1h_short_pct", type: "number", description: "Hourly holding fee for shorts (directional exchanges)" },
                { name: "holding_fee_24h_long_pct", type: "number", description: "24-hour holding fee for longs (directional exchanges)" },
                { name: "holding_fee_24h_short_pct", type: "number", description: "24-hour holding fee for shorts (directional exchanges)" },
              ]} />

              <h3 className="text-lg font-medium text-white mt-6 mb-4">Execution Fields</h3>
              <ParamTable params={[
                { name: "executed", type: "boolean | string", description: "Whether full order can be filled. \"PARTIAL\" if partial fill." },
                { name: "filled", type: "boolean", description: "True if order fully filled" },
                { name: "filled_usd", type: "number", description: "Amount that can be filled in USD" },
                { name: "unfilled_usd", type: "number", description: "Amount that cannot be filled" },
                { name: "max_leverage", type: "number", description: "Maximum leverage available" },
              ]} />

              <h3 className="text-lg font-medium text-white mt-6 mb-4">Price Fields</h3>
              <ParamTable params={[
                { name: "mid_price", type: "number", description: "Mid-market price" },
                { name: "best_bid", type: "number", description: "Best bid price (order book exchanges)" },
                { name: "best_ask", type: "number", description: "Best ask price (order book exchanges)" },
                { name: "symbol", type: "string", description: "Exchange-specific symbol" },
                { name: "timestamp", type: "number", description: "Unix timestamp of data" },
              ]} />

              <h3 className="text-lg font-medium text-white mt-6 mb-4">Buy/Sell Breakdown</h3>
              <p className="text-[#999] mb-4">
                The <code className="text-[#D8F213] bg-white/5 px-1.5 py-0.5 rounded">buy</code> and{" "}
                <code className="text-[#D8F213] bg-white/5 px-1.5 py-0.5 rounded">sell</code> objects 
                contain per-side execution details:
              </p>
              <ParamTable params={[
                { name: "avg_price", type: "number", description: "Average execution price for this side" },
                { name: "slippage_bps", type: "number", description: "Slippage for this side in bps" },
                { name: "filled_usd", type: "number", description: "Amount filled for this side" },
                { name: "unfilled_usd", type: "number", description: "Amount unfilled for this side" },
                { name: "levels_used", type: "number", description: "Order book levels consumed" },
              ]} />
            </Section>

            {/* Examples */}
            <Section id="examples" title="Examples">
              <h3 className="text-lg font-medium text-white mb-4">Full Response Example</h3>
              <p className="text-[#999] mb-4">
                Response for a $100,000 long position on Gold (XAU):
              </p>
              <CodeBlock 
                id="example-response"
                language="json"
                code={`{
  "asset": "XAU/USD",
  "symbol_key": "XAU",
  "order_size_usd": 100000.0,
  "order_type": "taker",
  "direction": "long",
  "winner": "veranta",
  "winner_cost_bps": 1.0,
  "symbols": {
    "hyperliquid": "xyz:GOLD",
    "lighter": "XAU",
    "aster": "XAUUSDT",
    "veranta": "XAU",
    "extended": "XAU-USD",
    "edgex": "XAU-USD",
    "grvt": "XAU_USDT",
    "variational": "XAU",
    "ondo": "XAU-USD.P",
    "pacifica": "XAU",
    "risex": "XAU/USDC",
    "txflow": "XAU-USDC"
  },
  "hyperliquid": {
    "exchange": "hyperliquid",
    "symbol": "xyz:GOLD",
    "executed": true,
    "filled": true,
    "filled_usd": 100000.0,
    "opening_slippage_bps": 1.06,
    "closing_slippage_bps": 1.03,
    "open_fee_bps": 9.0,
    "close_fee_bps": 9.0,
    "total_cost_bps": 20.09,
    "holding_fee_1h_pct": 0.00018,
    "holding_fee_24h_pct": 0.0042,
    "max_leverage": 20,
    "mid_price": 5139.05,
    "best_bid": 5139.0,
    "best_ask": 5139.1,
    "timestamp": 1771947188.14,
    "buy": {
      "avg_price": 5139.59,
      "slippage_bps": 1.06,
      "filled_usd": 100000.0,
      "levels_used": 6
    },
    "sell": {
      "avg_price": 5138.51,
      "slippage_bps": 1.03,
      "filled_usd": 100000.0,
      "levels_used": 5
    }
  }
  // ... other exchanges (lighter, aster, veranta, extended, edgex, grvt, variational, ondo, pacifica, risex, txflow)
}`}
                copyToClipboard={copyToClipboard}
                copiedId={copiedId}
              />

              <h3 className="text-lg font-medium text-white mt-8 mb-4">JavaScript Example</h3>
              <CodeBlock 
                id="js-example"
                language="javascript"
                code={`const response = await fetch(
  '${baseUrl}/api/compare/XAU?size=100000&direction=long'
);
const data = await response.json();

console.log(\`Best venue: \${data.winner}\`);
console.log(\`Total cost: \${data.winner_cost_bps} bps\`);

// Calculate USD cost
const usdCost = (data.order_size_usd * data.winner_cost_bps) / 10000;
console.log(\`USD cost: $\${usdCost.toFixed(2)}\`);`}
                copyToClipboard={copyToClipboard}
                copiedId={copiedId}
              />

              <h3 className="text-lg font-medium text-white mt-8 mb-4">Python Example</h3>
              <CodeBlock 
                id="python-example"
                language="python"
                code={`import requests

response = requests.get(
    '${baseUrl}/api/compare/XAU',
    params={
        'size': 100000,
        'direction': 'long',
        'order_type': 'taker'
    }
)
data = response.json()

print(f"Best venue: {data['winner']}")
print(f"Total cost: {data['winner_cost_bps']:.2f} bps")

# Get individual exchange costs
for exchange in ['hyperliquid', 'lighter', 'aster', 'veranta', 'extended', 'edgex', 'grvt', 'variational', 'ondo', 'pacifica', 'risex', 'txflow']:
    if data.get(exchange):
        cost = data[exchange].get('total_cost_bps', 'N/A')
        print(f"  {exchange}: {cost} bps")`}
                copyToClipboard={copyToClipboard}
                copiedId={copiedId}
              />
            </Section>

            {/* Errors */}
            <Section id="errors" title="Error Handling">
              <p>
                The API uses standard HTTP status codes to indicate success or failure.
              </p>

              <div className="overflow-x-auto my-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-4 text-[#666] font-medium">Status Code</th>
                      <th className="text-left py-3 px-4 text-[#666] font-medium">Meaning</th>
                    </tr>
                  </thead>
                  <tbody className="text-[#999]">
                    <tr className="border-b border-white/5">
                      <td className="py-3 px-4"><code className="text-[#D8F213]">200</code></td>
                      <td className="py-3 px-4">Success - comparison data returned</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-3 px-4"><code className="text-amber-400">400</code></td>
                      <td className="py-3 px-4">Bad Request - invalid parameters</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-3 px-4"><code className="text-amber-400">404</code></td>
                      <td className="py-3 px-4">Not Found - asset not supported</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-3 px-4"><code className="text-red-400">500</code></td>
                      <td className="py-3 px-4">Server Error - try again later</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4"><code className="text-red-400">503</code></td>
                      <td className="py-3 px-4">Service Unavailable - exchange API down</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-medium text-white mt-6 mb-4">Error Response Format</h3>
              <CodeBlock 
                id="error-example"
                language="json"
                code={`{
  "error": "Invalid asset",
  "message": "Asset 'INVALID' is not supported",
  "supported_assets": ["XAU", "XAG", "EURUSD", "GBPUSD", ...]
}`}
                copyToClipboard={copyToClipboard}
                copiedId={copiedId}
              />
            </Section>

            {/* Assets */}
            <Section id="assets" title="Supported Assets">
              <p>
                The following assets are supported. Use the asset key in the API path.
              </p>

              <div className="overflow-x-auto my-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-4 text-[#666] font-medium">Asset Key</th>
                      <th className="text-left py-3 px-4 text-[#666] font-medium">Name</th>
                      <th className="text-left py-3 px-4 text-[#666] font-medium">Category</th>
                    </tr>
                  </thead>
                  <tbody className="text-[#999]">
                    {[
                      { key: "XAU", name: "Gold", category: "Commodities" },
                      { key: "XAG", name: "Silver", category: "Commodities" },
                      { key: "WTI", name: "WTI Crude Oil", category: "Commodities" },
                      { key: "BRENT", name: "Brent Crude Oil", category: "Commodities" },
                      { key: "EURUSD", name: "Euro / US Dollar", category: "Forex" },
                      { key: "GBPUSD", name: "British Pound / US Dollar", category: "Forex" },
                      { key: "USDJPY", name: "US Dollar / Japanese Yen", category: "Forex" },
                      { key: "USDCAD", name: "US Dollar / Canadian Dollar", category: "Forex" },
                      { key: "USDCHF", name: "US Dollar / Swiss Franc", category: "Forex" },
                      { key: "AUDUSD", name: "Australian Dollar / US Dollar", category: "Forex" },
                      { key: "NZDUSD", name: "New Zealand Dollar / US Dollar", category: "Forex" },
                      { key: "AAPL", name: "Apple Inc.", category: "Equities" },
                      { key: "MSFT", name: "Microsoft Corporation", category: "Equities" },
                      { key: "GOOG", name: "Alphabet Inc.", category: "Equities" },
                      { key: "AMZN", name: "Amazon.com Inc.", category: "Equities" },
                      { key: "META", name: "Meta Platforms Inc.", category: "Equities" },
                      { key: "NVDA", name: "NVIDIA Corporation", category: "Equities" },
                      { key: "TSLA", name: "Tesla Inc.", category: "Equities" },
                      { key: "US500", name: "S&P 500", category: "Indices" },
                      { key: "US100", name: "Nasdaq 100", category: "Indices" },
                      { key: "COIN", name: "Coinbase Global Inc.", category: "Equities" },
                      { key: "HOOD", name: "Robinhood Markets Inc.", category: "Equities" },
                      { key: "SPCX", name: "SpaceX", category: "Equities" },
                      { key: "AMD", name: "Advanced Micro Devices Inc.", category: "Equities" },
                      { key: "INTC", name: "Intel Corporation", category: "Equities" },
                      { key: "MU", name: "Micron Technology Inc.", category: "Equities" },
                      { key: "SNDK", name: "SanDisk Corporation", category: "Equities" },
                      { key: "CBRS", name: "Cerebras Systems Inc.", category: "Equities" },
                      { key: "EWY", name: "iShares MSCI South Korea ETF", category: "Indices" },
                      { key: "BABA", name: "Alibaba Group", category: "Equities" },
                      { key: "CRCL", name: "Circle Internet Group Inc.", category: "Equities" },
                      { key: "MRVL", name: "Marvell Technology Inc.", category: "Equities" },
                      { key: "MSTR", name: "Strategy Inc.", category: "Equities" },
                      { key: "BB", name: "BlackBerry Ltd.", category: "Equities" },
                      { key: "PLTR", name: "Palantir Technologies Inc.", category: "Equities" },
                      { key: "AVGO", name: "Broadcom Inc.", category: "Equities" },
                      { key: "NFLX", name: "Netflix Inc.", category: "Equities" },
                      { key: "CRWV", name: "CoreWeave Inc.", category: "Equities" },
                      { key: "SKHY", name: "SK Hynix ADS", category: "Equities" },
                    ].map((asset) => (
                      <tr key={asset.key} className="border-b border-white/5">
                        <td className="py-3 px-4">
                          <code className="text-[#D8F213] bg-white/5 px-1.5 py-0.5 rounded">
                            {asset.key}
                          </code>
                        </td>
                        <td className="py-3 px-4 text-white">{asset.name}</td>
                        <td className="py-3 px-4">{asset.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Rate Limits */}
            <Section id="rate-limits" title="Rate Limits">
              <p>
                The API currently has generous rate limits suitable for most use cases:
              </p>
              <ul className="list-disc list-inside space-y-2 text-[#999] mt-4">
                <li><strong className="text-white">20 requests per 10 seconds</strong> per IP address</li>
              </ul>
              <p className="mt-4">
                If you need higher limits for production use, please contact us.
              </p>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 mt-4">
                <p className="text-[#888] text-sm">
                  Rate limit headers are included in responses:
                </p>
                <code className="block text-[#D8F213] text-sm mt-2">
                  X-RateLimit-Remaining: 95<br />
                  X-RateLimit-Reset: 1640000000
                </code>
              </div>
            </Section>

            {/* Footer */}
            <div className="mt-16 pt-8 border-t border-white/5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <p className="text-sm text-[#555]">
                  Need help? Check the <Link href="/docs" className="text-[#D8F213] hover:underline">methodology docs</Link> or reach out.
                </p>
                <Link 
                  href="/"
                  className="text-sm text-[#D8F213] hover:underline"
                >
                  ← Back to comparison tool
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function Section({ 
  id, 
  title, 
  children 
}: { 
  id: string; 
  title: string; 
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-16 scroll-mt-24">
      <h2 className="text-2xl font-light text-white mb-6">{title}</h2>
      <div className="prose prose-invert prose-sm max-w-none space-y-4 text-[#999] leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function EndpointHeader({ method, path }: { method: string; path: string }) {
  return (
    <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-4 mb-6">
      <span className={cn(
        "text-xs font-bold px-2.5 py-1 rounded",
        method === "GET" && "bg-emerald-500/20 text-emerald-400",
        method === "POST" && "bg-blue-500/20 text-blue-400",
        method === "PUT" && "bg-amber-500/20 text-amber-400",
        method === "DELETE" && "bg-red-500/20 text-red-400"
      )}>
        {method}
      </span>
      <code className="text-white font-mono text-sm">{path}</code>
    </div>
  );
}

function ParamTable({ params }: { params: Array<{ name: string; type: string; required?: boolean; description: string }> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-3 px-4 text-[#666] font-medium">Parameter</th>
            <th className="text-left py-3 px-4 text-[#666] font-medium">Type</th>
            <th className="text-left py-3 px-4 text-[#666] font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="text-[#999]">
          {params.map((param) => (
            <tr key={param.name} className="border-b border-white/5">
              <td className="py-3 px-4">
                <code className="text-[#D8F213] bg-white/5 px-1.5 py-0.5 rounded">{param.name}</code>
                {param.required && <span className="text-red-400 ml-2 text-xs">required</span>}
              </td>
              <td className="py-3 px-4 font-mono text-xs text-[#888]">{param.type}</td>
              <td className="py-3 px-4">{param.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlock({ 
  id,
  code, 
  language,
  copyToClipboard,
  copiedId 
}: { 
  id: string;
  code: string; 
  language?: string;
  copyToClipboard: (text: string, id: string) => void;
  copiedId: string | null;
}) {
  return (
    <div className="relative group">
      <pre className="bg-[#111] border border-white/5 rounded-xl p-4 overflow-x-auto">
        <code className="text-sm font-mono text-[#ccc] whitespace-pre">{code}</code>
      </pre>
      <button
        onClick={() => copyToClipboard(code, id)}
        className="absolute top-3 right-3 p-2 bg-white/5 hover:bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy to clipboard"
      >
        {copiedId === id ? (
          <Check className="w-4 h-4 text-[#D8F213]" />
        ) : (
          <Copy className="w-4 h-4 text-[#666]" />
        )}
      </button>
    </div>
  );
}
