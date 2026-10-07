// MIT License — Copyright (c) 2026 Decentralized Science Labs
// A Model Context Protocol server (https://modelcontextprotocol.io) for GL1F Crypto: tools that let an AI agent list
// Crypto AI models, read one, get the rules its backtest trades by, and ask it on GenesisL1, with the same Yes rule as
// the website (yes when threshold <= P <= threshold_max). Read-only: no keys, no wallet, nothing but public market data
// and the GenesisL1 RPC. Every tool declares the shape of its result (outputSchema).
import { parseModelId } from "./util.js";
import { DISCLAIMER } from "./models.js";

export const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
export const SERVER_INFO = { name: "gl1f-crypto", title: "GL1F Crypto", version: "1.13.0", websiteUrl: "https://crypto.gl1f.com/" };
export const INSTRUCTIONS = [
  "GL1F Crypto models are Crypto AI models trained on public market data and run on the GenesisL1 blockchain.",
  "Each one answers a single question about a coin, like \"Will ZEC rise 3% before it drops 1% within 5 hours?\",",
  "with a probability P for the latest completed candle. The answer is yes when threshold <= P <= threshold_max:",
  "by default 0.5 and 1, so yes at 50% or more; a user may ask for a stricter threshold or a range. Answers change only",
  "when a new candle closes. Use list_models to find models, get_model for one model's details, ask_model for its",
  "current answer, and trading_rules for the exact rules its backtest uses (entry, target, stop, time limit).",
  "Never present an answer as certain. If the user trades on it, follow its rules and the user's own size limits.",
  DISCLAIMER,
].join(" ");

const MODEL = { anyOf: [{ type: "integer", minimum: 1 }, { type: "string" }], description: "The model's number, like 1, or its link (https://crypto.gl1f.com/model.html?id=1)" };
const THRESHOLD = { type: "number", minimum: 0, maximum: 1, default: 0.5, description: "Yes when the probability is at least this (default 0.5)" };
const THRESHOLD_MAX = { type: "number", minimum: 0, maximum: 1, default: 1, description: "... and at most this (default 1: no upper limit)" };
const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const nullable = (type) => ({ type: [type, "null"] });
const SUMMARY = {
  id: { type: "integer" }, title: { type: "string" }, description: { type: "string" }, question: nullable("string"),
  market: { type: ["object", "null"], properties: { exchange: nullable("string"), symbol: { type: "string" }, coin: nullable("string"), candle: { type: "string" } } },
  access: { type: "string", enum: ["free", "tips", "paid"] }, feePerRunL1: { type: "string" }, inferenceEnabled: { type: "boolean" },
  signals: nullable("integer"), url: { type: "string" },
};
const RULES = { type: "object", required: ["model", "direction", "threshold", "thresholdMax", "candle", "summary"], properties: {
  model: { type: "integer" }, direction: { type: "string", enum: ["long", "short"] }, threshold: { type: "number" }, thresholdMax: { type: "number" },
  candle: { type: "string" }, market: { type: "string" }, signal: { type: "string" }, entry: { type: "string" }, baseline: { type: "string" },
  basePeriod: { type: "integer" }, targetPct: { type: "number" }, stopPct: { type: "number" }, horizonCandles: { type: "integer" },
  horizonMinutes: { type: "integer" }, exit: { type: "string" }, onePositionAtATime: { type: "boolean" }, summary: { type: "string" } } };
const ANSWER = { type: "object", required: ["model", "answer", "yes", "probability", "threshold", "thresholdMax", "candleClose"], properties: {
  model: { type: "integer" }, title: { type: "string" }, question: { type: "string" }, answer: { type: "string", enum: ["yes", "no"] },
  yes: { type: "boolean" }, probability: { type: "number", minimum: 0, maximum: 1 }, threshold: { type: "number" }, thresholdMax: { type: "number" },
  rule: { type: "string" }, candleClose: { type: "string", description: "ISO 8601 time the answered candle closed" }, market: { type: "string" },
  answeredOn: { type: "string" }, url: { type: "string" }, disclaimer: { type: "string" } } };

export const TOOLS = [
  { name: "list_models", title: "List Crypto AI models",
    description: "Lists published Crypto AI models, newest first: number, title, the question it answers, its market and candle, access (free, tips or paid) and its page.",
    inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 20, description: "How many (default 10)" }, before: { type: "integer", minimum: 2, description: "Models numbered below this one, to page through (from the previous result's more.before)" } }, additionalProperties: false },
    outputSchema: { type: "object", required: ["total", "models"], properties: { total: { type: "integer" }, models: { type: "array", items: { type: "object", required: ["id", "title", "access", "url"], properties: SUMMARY } },
      more: { type: ["object", "null"], properties: { before: { type: "integer" } } } } },
    annotations: { title: "List Crypto AI models", ...READ } },
  { name: "get_model", title: "Get a Crypto AI model",
    description: "One model's details: its question, market (exchange, symbol, candle), access and fee, number of signals, its page, and the trading rules its backtest uses.",
    inputSchema: { type: "object", properties: { model: MODEL }, required: ["model"], additionalProperties: false },
    outputSchema: { type: "object", required: ["id", "title", "access", "url"], properties: { ...SUMMARY, tradingRules: { anyOf: [RULES, { type: "null" }] } } },
    annotations: { title: "Get a Crypto AI model", ...READ } },
  { name: "ask_model", title: "Ask a Crypto AI model now",
    description: "Runs a free or tip model on the latest completed candle: the inputs come from public exchange data, the answer from the model on GenesisL1. Returns yes or no, the probability, the Yes range used, the candle it is for and the model's page. The answer is yes when threshold <= probability <= threshold_max (defaults 0.5 and 1). Paid models are not available here.",
    inputSchema: { type: "object", properties: { model: MODEL, threshold: THRESHOLD, threshold_max: THRESHOLD_MAX }, required: ["model"], additionalProperties: false },
    outputSchema: ANSWER,
    annotations: { title: "Ask a Crypto AI model now", ...READ, idempotentHint: false } },
  { name: "trading_rules", title: "A model's trading rules",
    description: "The exact rules the site's Backtest page trades a model by: direction, the signal (threshold <= P <= threshold_max), entry at the next candle's open only between stop and target, target and stop in percent from an EMA baseline, the time limit in candles, and one position at a time.",
    inputSchema: { type: "object", properties: { model: MODEL, threshold: THRESHOLD, threshold_max: THRESHOLD_MAX }, required: ["model"], additionalProperties: false },
    outputSchema: RULES,
    annotations: { title: "A model's trading rules", ...READ } },
];

const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const fail = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

export function createMcp({ models, log = console }) {
  const idOf = (v) => {
    const id = typeof v === "number" ? (Number.isInteger(v) && v > 0 ? v : null) : parseModelId(v);
    if (!id) throw new Error("model must be a model number, like 1, or its link");
    return id;
  };
  const rangeOf = (args) => ({ threshold: args.threshold, thresholdMax: args.threshold_max ?? args.thresholdMax });
  async function run(name, args) {
    if (name === "list_models") return models.list({ limit: args.limit, before: args.before });
    const id = idOf(args.model);
    if (name === "ask_model") return models.ask(id, rangeOf(args));
    const m = await models.model(id);
    if (name === "trading_rules") {
      const r = models.rules(m, rangeOf(args));
      if (!r) throw new Error(`Model #${id} has no market profile, so it has no trading rules.`);
      return r;
    }
    return { ...models.describe(m), tradingRules: models.rules(m) };
  }
  async function handle(msg) {
    if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
      return msg && typeof msg === "object" && "id" in msg ? fail(msg.id ?? null, -32600, "Invalid request") : null;
    }
    const notification = !("id" in msg) || msg.id === null && msg.method.startsWith("notifications/");
    switch (msg.method) {
      case "initialize": {
        const asked = msg.params?.protocolVersion;
        return ok(msg.id, { protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS });
      }
      case "ping": return ok(msg.id, {});
      case "tools/list": return ok(msg.id, { tools: TOOLS });
      case "tools/call": {
        const name = msg.params?.name, args = msg.params?.arguments || {};
        if (!TOOLS.some((t) => t.name === name)) return fail(msg.id, -32602, `Unknown tool: ${name}`);
        try {
          const data = await run(name, args);
          return ok(msg.id, { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data, isError: false });
        } catch (e) {
          log.warn?.(`${name}: ${e.shortMessage || e.message}`);
          return ok(msg.id, { content: [{ type: "text", text: e.shortMessage || e.message }], isError: true });
        }
      }
      default:
        if (msg.method.startsWith("notifications/") || notification) return null;   // initialized, cancelled, ...
        return fail(msg.id, -32601, `Method not found: ${msg.method}`);
    }
  }
  return { handle };
}
