// MIT License — Copyright (c) 2026 Decentralized Science Labs
// The MCP server: protocol, tools, the Yes range, HTTP and stdio transports, and the official MCP TypeScript client
// (which also checks every result against its tool's declared output shape).
import { createModels } from "../lib/models.js";
import { createMcp, TOOLS, PROTOCOL_VERSIONS } from "../lib/mcp.js";
import { httpHandler, serveStdio } from "../lib/mcp_transport.js";
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };
const M15 = 15 * 60_000, NOW = Date.UTC(2026, 9, 7, 10, 7, 0);

function fakeModels(now = () => NOW) {
  const label = { direction: "up", movePct: 3, retracePct: 1, basePeriod: 5, horizonBars: 20 };
  const profile = { symbol: "ZECUSDT", ticker: "ZEC", candle: "15m", exchange: "binance", label };
  const all = {
    1: { tokenId: 1, title: "ZEC 15m UP 3% · 5h", description: "d", pricingMode: 0, feeWei: 0n, inferenceEnabled: true, nFeatures: 19, profile },
    2: { tokenId: 2, title: "Paid", pricingMode: 2, feeWei: 10n ** 16n, inferenceEnabled: true, nFeatures: 9, profile },
    3: { tokenId: 3, title: "No profile", pricingMode: 0, feeWei: 0n, profile: null, nFeatures: 3 },
  };
  let asks = 0;
  const sdk = {
    async model(id) { if (!all[id]) throw new Error(`No Crypto AI model #${id}`); return all[id]; },
    async nft() { return { totalMinted: async () => 3n }; },
    async latestInputs() { asks++; return { valuesQ: [1, 2], selectedOpenMs: Math.floor(now() / M15) * M15 - M15 }; },
    async predict() { return { probability: 0.728, via: "predictView" }; },
  };
  const questionText = (p) => `Will ${p.ticker} rise ${p.label.movePct}% before it drops ${p.label.retracePct}% within 5 hours?`;
  return { models: createModels({ sdk, engine: {}, questionText, siteUrl: "https://crypto.gl1f.com/", now }), get asks() { return asks; } };
}
const rpc = (id, method, params) => ({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) });

Deno.test("protocol: initialize, tools, calls and errors", async () => {
  const f = fakeModels(), mcp = createMcp({ models: f.models, log: {} });
  let r = await mcp.handle(rpc(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } }));
  assert(r.result.protocolVersion === "2025-06-18" && r.result.capabilities.tools && r.result.serverInfo.name === "gl1f-crypto" && r.result.instructions.includes("trading_rules"), "initialize");
  r = await mcp.handle(rpc(2, "initialize", { protocolVersion: "1999-01-01" })); assert(r.result.protocolVersion === PROTOCOL_VERSIONS[0], "unknown version: the newest");
  assert(await mcp.handle({ jsonrpc: "2.0", method: "notifications/initialized" }) === null, "notifications get no reply");
  assert(r.result.serverInfo.version === "1.13.0" && r.result.instructions.includes("threshold_max"), "version and the Yes rule in the instructions");
  r = await mcp.handle(rpc(3, "tools/list")); assert(r.result.tools.length === 4 && r.result.tools.every((t) => t.inputSchema.type === "object" && t.outputSchema?.type === "object" && t.annotations.readOnlyHint), "four read-only tools, each with an output shape");
  assert(["ask_model", "trading_rules"].every((n) => { const t = r.result.tools.find((x) => x.name === n); return t.inputSchema.properties.threshold.default === 0.5 && t.inputSchema.properties.threshold_max.default === 1; }), "threshold inputs with their defaults");
  r = await mcp.handle(rpc(4, "tools/call", { name: "list_models", arguments: { limit: 2 } }));
  assert(r.result.structuredContent.total === 3 && r.result.structuredContent.models.length === 2 && r.result.structuredContent.models[0].id === 3 && r.result.structuredContent.more.before === 2, "list newest first, paged");
  r = await mcp.handle(rpc(5, "tools/call", { name: "list_models", arguments: { before: 2 } })); assert(r.result.structuredContent.models.map((m) => m.id).join() === "1", "next page");
  r = await mcp.handle(rpc(6, "tools/call", { name: "get_model", arguments: { model: "https://crypto.gl1f.com/model.html?id=1" } }));
  const g = r.result.structuredContent;
  assert(g.question.startsWith("Will ZEC rise 3%") && g.market.symbol === "ZECUSDT" && g.access === "free" && g.tradingRules.targetPct === 3 && g.tradingRules.stopPct === 1 && g.tradingRules.horizonMinutes === 300, "get_model with rules, by link");
  r = await mcp.handle(rpc(7, "tools/call", { name: "ask_model", arguments: { model: 1 } }));
  const a = r.result.structuredContent;
  assert(!r.result.isError && a.answer === "yes" && a.yes === true && a.probability === 0.728 && a.threshold === 0.5 && a.thresholdMax === 1 && a.rule === "yes when P ≥ 0.50"
    && a.candleClose === "2026-10-07T10:00:00.000Z" && a.answeredOn === "GenesisL1 (predictView)" && a.disclaimer, "ask_model, default range");
  await mcp.handle(rpc(8, "tools/call", { name: "ask_model", arguments: { model: 1 } })); assert(f.asks === 1, "one answer per candle");
  // The caller's Yes range is applied to that same answer: no second run.
  const ask = async (args) => (await mcp.handle(rpc(80, "tools/call", { name: "ask_model", arguments: { model: 1, ...args } }))).result;
  let x = await ask({ threshold: 0.75 }); assert(x.structuredContent.answer === "no" && x.structuredContent.threshold === 0.75, "0.728 is under a 0.75 threshold");
  x = await ask({ threshold: 0.6, threshold_max: 0.7 }); assert(x.structuredContent.answer === "no" && x.structuredContent.rule === "yes when 0.60 ≤ P ≤ 0.70", "0.728 is above a 0.70 upper limit");
  x = await ask({ threshold: 0.7, threshold_max: 0.8 }); assert(x.structuredContent.answer === "yes" && x.structuredContent.yes, "0.728 is inside 0.70–0.80");
  x = await ask({ threshold: 0.4 }); assert(x.structuredContent.answer === "yes", "a lower threshold");
  assert(f.asks === 1, "every range used the one run");
  x = await ask({ threshold: 1.5 }); assert(x.isError && x.content[0].text.includes("from 0 to 1"), "a threshold above 1 is refused");
  x = await ask({ threshold: 0.8, threshold_max: 0.6 }); assert(x.isError && x.content[0].text.includes("not be above"), "a threshold above its upper limit is refused");
  r = await mcp.handle(rpc(9, "tools/call", { name: "trading_rules", arguments: { model: 1, threshold: 0.65 } }));
  assert(r.result.structuredContent.threshold === 0.65 && r.result.structuredContent.thresholdMax === 1 && r.result.structuredContent.summary.includes("P ≥ 0.65") && r.result.structuredContent.direction === "long", "trading rules");
  r = await mcp.handle(rpc(91, "tools/call", { name: "trading_rules", arguments: { model: 1, threshold: 0.6, threshold_max: 0.85 } }));
  assert(r.result.structuredContent.summary.startsWith("Long when 0.60 ≤ P ≤ 0.85") && r.result.structuredContent.signal.startsWith("0.60 ≤ P ≤ 0.85"), "trading rules with a range");
  r = await mcp.handle(rpc(10, "tools/call", { name: "ask_model", arguments: { model: 2 } })); assert(r.result.isError && r.result.content[0].text.includes("paid"), "paid models are refused");
  r = await mcp.handle(rpc(11, "tools/call", { name: "trading_rules", arguments: { model: 3 } })); assert(r.result.isError, "no profile: no rules");
  r = await mcp.handle(rpc(12, "tools/call", { name: "get_model", arguments: { model: "abc" } })); assert(r.result.isError && r.result.content[0].text.includes("model number"), "bad argument");
  r = await mcp.handle(rpc(13, "tools/call", { name: "nope" })); assert(r.error.code === -32602, "unknown tool");
  r = await mcp.handle(rpc(14, "resources/list")); assert(r.error.code === -32601, "unknown method");
  r = await mcp.handle({ id: 15, method: "ping" }); assert(r.error.code === -32600, "not JSON-RPC 2.0");
  r = await mcp.handle(rpc(16, "ping")); assert(JSON.stringify(r.result) === "{}", "ping");
});

Deno.test("HTTP: JSON answers, notifications, GET, CORS, errors and the rate limit", async () => {
  const mcp = createMcp({ models: fakeModels().models, log: {} }), h = httpHandler(mcp, { perMinute: 5 });
  const post = (body, extra = {}) => h(new Request("http://x/mcp", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": extra.ip || "1.1.1.1" }, body: typeof body === "string" ? body : JSON.stringify(body) }), {});
  let r = await post(rpc(1, "ping")); assert(r.status === 200 && r.headers.get("content-type") === "application/json" && (await r.json()).result, "POST answered as JSON");
  r = await post({ jsonrpc: "2.0", method: "notifications/initialized" }); assert(r.status === 202, "notification: 202");
  r = await post("{nope"); assert(r.status === 400 && (await r.json()).error.code === -32700, "parse error");
  r = await h(new Request("http://x/mcp"), {}); assert(r.status === 405, "GET: no stream");
  r = await h(new Request("http://x/mcp", { method: "OPTIONS" }), {}); assert(r.status === 204 && r.headers.get("access-control-allow-headers").includes("mcp-protocol-version"), "CORS preflight");
  r = await post(rpc(2, "ping")); r = await post(rpc(3, "ping"));
  r = await post(rpc(4, "ping")); assert(r.status === 429, "rate limited per client");
  r = await post(rpc(5, "ping"), { ip: "2.2.2.2" }); assert(r.status === 200, "other clients are not");
  r = await h(new Request("http://x/mcp", { method: "POST", headers: { "content-length": "999999", "x-forwarded-for": "3.3.3.3" }, body: "{}" }), {}); assert(r.status === 413, "too large");
});

Deno.test("stdio: one JSON message per line", async () => {
  const mcp = createMcp({ models: fakeModels().models, log: {} });
  const input = new ReadableStream({ start(c) { const e = new TextEncoder(); c.enqueue(e.encode(JSON.stringify(rpc(1, "initialize", { protocolVersion: "2025-06-18" })) + "\n" + JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n")); c.enqueue(e.encode(JSON.stringify(rpc(2, "tools/call", { name: "ask_model", arguments: { model: 1 } })) + "\n")); c.close(); } });
  const chunks = [], output = new WritableStream({ write(c) { chunks.push(new TextDecoder().decode(c)); } });
  await serveStdio(mcp, { input, output }); await new Promise((r) => setTimeout(r, 50));
  const lines = chunks.join("").trim().split("\n").map((l) => JSON.parse(l));
  assert(lines.length === 2 && lines.find((l) => l.id === 1).result.serverInfo && lines.find((l) => l.id === 2).result.structuredContent.answer === "yes", "stdio round trip");
});

Deno.test("the official MCP TypeScript client connects over HTTP", async () => {
  const { Client } = await import("npm:@modelcontextprotocol/sdk@1/client/index.js");
  const { StreamableHTTPClientTransport } = await import("npm:@modelcontextprotocol/sdk@1/client/streamableHttp.js");
  const mcp = createMcp({ models: fakeModels().models, log: {} });
  const server = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen() {} }, httpHandler(mcp));
  try {
    const client = new Client({ name: "gl1f-test", version: "1.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.addr.port}/mcp`)));
    const tools = await client.listTools();
    assert(tools.tools.map((t) => t.name).sort().join() === TOOLS.map((t) => t.name).sort().join(), "tools listed");
    // The client checks every result against the tool's declared output shape (outputSchema).
    const asked = await client.callTool({ name: "ask_model", arguments: { model: 1 } });
    assert(!asked.isError && asked.structuredContent.answer === "yes" && JSON.parse(asked.content[0].text).probability === 0.728, "ask_model through the client");
    const strict = await client.callTool({ name: "ask_model", arguments: { model: 1, threshold: 0.6, threshold_max: 0.7 } });
    assert(!strict.isError && strict.structuredContent.answer === "no" && strict.structuredContent.thresholdMax === 0.7, "ask_model with a range through the client");
    const rules = await client.callTool({ name: "trading_rules", arguments: { model: 1, threshold: 0.6 } });
    assert(rules.structuredContent.targetPct === 3 && rules.structuredContent.threshold === 0.6, "trading_rules through the client");
    const listed = await client.callTool({ name: "list_models", arguments: { limit: 3 } });
    assert(!listed.isError && listed.structuredContent.models.length === 3, "list_models through the client");
    const got = await client.callTool({ name: "get_model", arguments: { model: 3 } });
    assert(!got.isError && got.structuredContent.tradingRules === null && got.structuredContent.question === null, "get_model with no profile matches its shape");
    assert(client.getServerVersion().name === "gl1f-crypto", "server info");
    await client.close();
  } finally { await server.shutdown(); }
});
