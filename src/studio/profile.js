// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Input profile: the contract that lets inference rebuild a model's exact inputs.
import { sha256Hex } from "./ui.js";

export const PROFILE_SCHEMA = "gl1f-dataset-profile/v1";
export const INTERVAL_MIN = Object.freeze({ "1m": 1, "3m": 3, "5m": 5, "15m": 15, "30m": 30, "1h": 60, "2h": 120, "4h": 240, "6h": 360, "8h": 480, "12h": 720, "1d": 1440 });
export const VENUES = Object.freeze({
  "binance-usdm": Object.freeze({ exchange: "binance", name: "Binance USD-M", short: "Binance", btc: "BTCUSDT" }),
  "coinbase-spot": Object.freeze({ exchange: "coinbase", name: "Coinbase", short: "Coinbase", btc: "BTC-USD" }),
  "hyperliquid-perp": Object.freeze({ exchange: "hyperliquid", name: "Hyperliquid", short: "Hyperliquid", btc: "BTC" }),
});
export const EXCHANGE_VENUE = Object.freeze({ binance: "binance-usdm", coinbase: "coinbase-spot", hyperliquid: "hyperliquid-perp" });

export function durationLabel(minutes) {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) return "—";
  if (m % 1440 === 0) return `${m / 1440}d`;
  if (m % 60 === 0) return `${m / 60}h`;
  return `${m}m`;
}
export function horizonLabel(bars, candle) {
  return durationLabel(Number(bars) * (INTERVAL_MIN[candle] || NaN));
}
// "5 hours", "1 day", "30 minutes": for plain-language questions and share previews.
export function horizonWords(bars, candle) {
  const m = Number(bars) * (INTERVAL_MIN[candle] || NaN);
  if (!Number.isFinite(m) || m <= 0) return "the horizon";
  const [n, unit] = m % 1440 === 0 ? [m / 1440, "day"] : m % 60 === 0 ? [m / 60, "hour"] : [m, "minute"];
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}
// The yes-or-no question a Crypto AI model answers, e.g. "Will ETH rise 1% before it drops 0.5% within 5 hours?"
export function questionText(profile) {
  const l = profile?.label;
  if (!l) return null;
  const up = l.direction !== "down", coin = profile.ticker || profile.symbol || "the coin";
  return `Will ${coin} ${up ? "rise" : "fall"} ${l.movePct}% before it ${up ? "drops" : "bounces"} ${l.retracePct}% within ${horizonWords(l.horizonBars, profile.candle)}?`;
}
export function marketLabel(profile) {
  return profile ? `${profile.symbol} · ${VENUES[profile.venue]?.short || profile.venue} · ${profile.candle}` : "—";
}
export function targetLabel(label, candle) {
  if (!label) return "—";
  const up = label.direction !== "down";
  return `${up ? "Up" : "Down"} ${label.movePct}% from EMA${label.basePeriod} before ${up ? "−" : "+"}${label.retracePct}% · within ${horizonLabel(label.horizonBars, candle)}`;
}

// Full profile exported next to the CSV.
export async function buildProfile(result, runtime) {
  const c = result.contract || {}, stats = result.stats || {};
  const featureOrder = result.header.slice(1, -1);
  const csvSha256 = await sha256Hex(result.blob);
  const featureOrderSha256 = await sha256Hex(featureOrder.join("\n") + "\n");
  const iso = (ms) => (Number.isFinite(Number(ms)) ? new Date(Number(ms)).toISOString() : null);
  return {
    schema: PROFILE_SCHEMA,
    app: { name: "GL1F Crypto", runtime: runtime?.id || "crypto", origin: runtime?.origin || "https://crypto.gl1f.com" },
    venue: c.venue,
    exchange: c.exchange,
    quote: c.quote,
    ticker: c.ticker,
    symbol: c.symbol,
    btcContext: c.btcContext,
    market: { venue: c.venue, quote: c.quote, ticker: c.ticker, symbol: c.symbol, candle: c.candle, btcContext: c.btcContext },
    candle: c.candle,
    featureFamily: c.featureFamily,
    featureVersion: c.featureVersion,
    featureOrder,
    inputCast: "float32",
    availability: "after-close",
    warmupBars: result.warmupBars,
    featureSeedStartMs: c.featureSeedStartMs,
    featureContract: {
      builder: c.featureFamily, version: c.featureVersion, inputCast: "float32", availability: "after-close",
      warmupBars: result.warmupBars, featureSeedStartMs: c.featureSeedStartMs,
      firstSourceCandleOpenMs: c.sourceFirstCandleOpenMs, firstCompleteFeatureOpenMs: c.firstCompleteFeatureOpenMs,
      gapPolicy: c.exchange !== "binance" ? "no-trade buckets filled with the previous close and zero volume" : "none",
    },
    tailTransform: { kind: "signed-log1p", start: 1000, columns: stats.tailColumns || [] },
    quantization: { rounding: "Math.round", scaleQ: stats.scaleQ, target: "signed-int32", safeIntegerCap: 2147480000, pipeline: "derived-f64 → fixed-tail → float32 → Math.round(f32 × scaleQ) → int32" },
    label: { ...c.label, task: "binary_classification", positiveClass: 1, negativeClass: 0, tiePolicy: "stop-wins" },
    task: "binary_classification",
    decisionThreshold: 0.5,
    ranges: {
      requested: { startUtc: iso(c.requestedStartMs), endExclusiveUtc: iso(c.requestedEndExclusiveMs) },
      exported: { firstOpenMs: c.exportFirstOpenMs, firstOpenUtc: iso(c.exportFirstOpenMs), lastOpenMs: c.exportLastOpenMs, lastOpenUtc: iso(c.exportLastOpenMs), endExclusiveUtc: iso(c.exportEndExclusiveMs) },
      sources: (result.sources || []).map((s) => ({ ...s, firstOpenUtc: iso(s.firstOpenMs), lastOpenUtc: iso(s.lastOpenMs) })),
      funding: result.fundingSource || null,
    },
    dataset: {
      filename: result.filename, mediaType: "text/csv", bytes: result.blob.size, rows: stats.rows,
      featureColumns: featureOrder.length, timeColumn: "open_time", targetColumn: "label",
      checksum: { algorithm: "sha-256", encoding: "hex", value: csvSha256 },
    },
    audit: {
      status: "passed", requestedFeatureCount: stats.requestedFeatures, exportedFeatureCount: stats.features,
      removedColumns: stats.removed || [], featureOrderChecksum: { algorithm: "sha-256", encoding: "hex", value: featureOrderSha256 },
      finite: true, float32Checked: true, int32Safe: true, scaleQ: stats.scaleQ,
    },
    candles: { reusedRows: result.cache?.reusedRows || 0, fetchedRows: result.cache?.fetchedRows || 0, requests: result.cache?.requests || 0, filledNoTradeRows: result.cache?.synthetic || 0 },
  };
}

// Subset stored in the Model NFT metadata (featuresPacked #meta.dataset).
export function compactProfile(p) {
  if (!p) return null;
  const label = p.label || {};
  return {
    schema: PROFILE_SCHEMA,
    venue: p.venue, symbol: p.symbol, ticker: p.ticker, quote: p.quote, btcContext: p.btcContext,
    candle: p.candle, featureFamily: p.featureFamily, featureVersion: p.featureVersion,
    featureSeedStartMs: p.featureSeedStartMs, warmupBars: p.warmupBars,
    inputCast: "float32", availability: "after-close", scaleQ: p.scaleQ ?? p.quantization?.scaleQ ?? 1_000_000,
    label: { direction: label.direction, basePeriod: label.basePeriod, movePct: label.movePct, retracePct: label.retracePct, horizonBars: label.horizonBars },
    featureOrderSha256: p.featureOrderSha256 || p.audit?.featureOrderChecksum?.value || null,
  };
}

// Accept a full, compact or legacy (Binance-only) profile. Returns null when absent.
export function normalizeProfile(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.schema && raw.schema !== PROFILE_SCHEMA) throw new Error(`Unsupported input profile schema ${raw.schema}`);
  const venue = raw.venue || raw.market?.venue;
  const info = VENUES[venue];
  if (!info) throw new Error(`Unsupported market venue ${venue || "(missing)"}`);
  const candle = raw.candle || raw.market?.candle;
  if (!(candle in INTERVAL_MIN)) throw new Error(`Unsupported candle ${candle || "(missing)"}`);
  const symbol = String(raw.symbol || raw.market?.symbol || "").toUpperCase();
  const ticker = String(raw.ticker || raw.market?.ticker || symbol.split("-")[0].replace(/USDT$/, "")).toUpperCase();
  const quote = String(raw.quote || raw.market?.quote || (info.exchange === "binance" ? "USDT" : symbol.split("-")[1] || "USD")).toUpperCase();
  const label = raw.label || {};
  const seed = raw.featureSeedStartMs ?? raw.featureContract?.featureSeedStartMs;
  return {
    venue, exchange: info.exchange, exchangeName: info.name, exchangeShort: info.short,
    symbol: symbol && symbol !== "*" ? symbol : (info.exchange === "binance" ? `${ticker}USDT` : `${ticker}-${quote}`),
    ticker, quote, btcContext: String(raw.btcContext || raw.market?.btcContext || info.btc).toUpperCase(),
    candle, featureFamily: raw.featureFamily || raw.featureContract?.builder || "auto", featureVersion: raw.featureVersion || null,
    featureSeedStartMs: seed === null || seed === undefined || seed === "" ? null : Number(seed),
    warmupBars: Number(raw.warmupBars ?? raw.featureContract?.warmupBars) || null,
    scaleQ: Number(raw.scaleQ ?? raw.quantization?.scaleQ) || 1_000_000,
    label: label.direction ? {
      direction: label.direction, basePeriod: Number(label.basePeriod), movePct: Number(label.movePct),
      retracePct: Number(label.retracePct), horizonBars: Number(label.horizonBars),
    } : null,
    featureOrder: Array.isArray(raw.featureOrder) ? raw.featureOrder.map(String) : null,
    featureOrderSha256: raw.featureOrderSha256 || raw.audit?.featureOrderChecksum?.value || null,
  };
}

// The profile bound to the model's own signals: wherever it records the signal order or its SHA-256, they now describe
// featureNames. A dataset trimmed for retraining keeps its rows and settings with fewer signals, so its profile must
// describe the list the model was trained on (before 1.10.5 it kept the larger list's checksum).
export async function profileForFeatures(profile, featureNames) {
  if (!profile || typeof profile !== "object") return profile;
  const names = [...featureNames], value = await sha256Hex(names.join("\n") + "\n");
  const walk = (node) => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "featureOrder" && Array.isArray(v)) out[k] = [...names];
      else if (k === "features" && Array.isArray(v) && v.every((x) => typeof x === "string")) out[k] = [...names];
      else if (k === "featureOrderSha256" && typeof v === "string") out[k] = value;
      else if (k === "featureOrderChecksum" && v && typeof v === "object") out[k] = { ...v, value };
      else out[k] = walk(v);
    }
    return out;
  };
  const bound = walk(profile);
  if (!("featureOrderSha256" in bound) && !bound.audit?.featureOrderChecksum) bound.featureOrderSha256 = value;
  return bound;
}

export async function verifyProfileFeatures(profile, featureNames) {
  if (!profile) return;
  if (profile.featureOrder && profile.featureOrder.join("\n") !== featureNames.join("\n")) {
    throw new Error("The input profile's feature order does not match the model");
  }
  if (profile.featureOrderSha256) {
    const actual = await sha256Hex(featureNames.join("\n") + "\n");
    if (actual !== String(profile.featureOrderSha256).toLowerCase()) throw new Error("The input profile's feature checksum does not match the model");
  }
}

export function packFeatures(featureNames, profile, report = null) {
  const meta = { v: 1, task: "binary_classification", labelName: "label", labels: ["0", "1"] };
  const compact = compactProfile(profile);
  if (compact) meta.dataset = compact;
  if (report) meta.report = report;  // the verifiable training report, fixed at mint
  return [`#meta=${JSON.stringify(meta)}`, ...featureNames.map((f) => String(f).trim()).filter(Boolean)].join("\n");
}

export function unpackFeatures(text) {
  const lines = String(text || "").split("\n").map((s) => s.trim()).filter(Boolean);
  let meta = null, start = 0;
  if (lines[0]?.startsWith("#meta=")) {
    try { meta = JSON.parse(lines[0].slice(6)); } catch { meta = null; }
    start = 1;
  }
  return { meta, features: lines.slice(start) };
}

export function profileFromMeta(meta) {
  try { return normalizeProfile(meta?.dataset || meta?.inputProfile || null); } catch { return null; }
}

export function titleWords(title) {
  return [...new Set(String(title || "").toLowerCase().split(/[\s,]+/).map((w) => w.trim()).filter((w) => w.length >= 2))];
}

export function defaultTitle(profile) {
  if (!profile?.label) return profile ? `${profile.ticker} ${profile.candle} model` : "Crypto model";
  const l = profile.label;
  return `${profile.ticker} ${profile.candle} ${l.direction === "down" ? "DOWN" : "UP"} ${l.movePct}% · ${horizonLabel(l.horizonBars, profile.candle)}`;
}

export function defaultDescription(profile, summary = {}) {
  if (!profile?.label) return "Binary GL1F model for crypto markets.";
  const l = profile.label, up = l.direction !== "down";
  const lead = `Probability that ${profile.symbol} on ${VENUES[profile.venue]?.name || profile.venue} ${up ? "rises" : "falls"} ${l.movePct}% from EMA${l.basePeriod} before a ${l.retracePct}% ${up ? "drawdown" : "rebound"} within ${horizonLabel(l.horizonBars, profile.candle)} (${profile.candle} candles).`;
  const facts = [
    summary.features ? `${summary.features} features` : null,
    summary.validation || null,
    Number.isFinite(summary.auc) ? `test ROC AUC ${summary.auc.toFixed(3)}` : null,
  ].filter(Boolean);
  return (facts.length ? `${lead} ${facts.join(", ").replace(/^./, (c) => c.toUpperCase())}.` : lead).slice(0, 600);
}
