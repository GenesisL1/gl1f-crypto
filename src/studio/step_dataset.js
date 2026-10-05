// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Step 1 · Dataset
import { $, el, fmtInt, fmtBytes, fmtUtc, segmented, setProgress, showError, downloadBlob, downloadJson, renderStats, table } from "./ui.js";
import { featureLabel, featureTitle } from "./feature_labels.js";
import { buildProfile, INTERVAL_MIN, horizonLabel, targetLabel } from "./profile.js";
import { labelDiagram, timeChart } from "./charts.js";
import { setKV as setKVList } from "./ui.js";

const DAY = 86_400_000;
const CB_NATIVE = [1440, 360, 60, 15, 5, 1];
const MARKET_DEFAULT = { binance: "ETH", coinbase: "ETH-USD", hyperliquid: "ETH" };
const EXCHANGE_NAME = { binance: "Binance", coinbase: "Coinbase", hyperliquid: "Hyperliquid" };
const EXCHANGE_FULL = { binance: "Binance USD-M", coinbase: "Coinbase", hyperliquid: "Hyperliquid" };
const MISSING = { binance: "", coinbase: "funding, trade counts or taker flow", hyperliquid: "taker flow" };
// Hyperliquid native candle sizes (minutes); its API keeps the latest 5,000 candles per size.
const HL_NATIVE = [1440, 720, 480, 240, 120, 60, 30, 15, 5, 3, 1];
function hyperliquidCoin(text) {
  let coin = String(text || "").trim().replace(/[\s/_-]+(PERP|USDC|USD)$/i, "").replace(/[\s/_-]+/g, "");
  if (/^1000[A-Za-z0-9]+$/.test(coin)) coin = `k${coin.slice(4).toUpperCase()}`;
  else if (!/^k[A-Z0-9]+$/.test(coin)) coin = coin.toUpperCase();
  return coin;
}
function convertMarket(value, to) {
  let base = (String(value || "").trim().replace(/[\s/_-]+(PERP|USDC|USDT|USD|EUR|GBP)$/i, "").split(/[\s/_-]+/)[0] || "").replace(/USDT$/i, "");
  if (/^k[A-Z0-9]+$/.test(base)) base = `1000${base.slice(1)}`;
  base = base.toUpperCase();
  if (to === "coinbase") return `${base.replace(/^1000/, "")}-USD`;
  if (to === "hyperliquid") return /^1000[A-Z0-9]+$/.test(base) ? `k${base.slice(4)}` : base;
  return base;
}

export function initDataset(ctx) {
  const { state, market } = ctx;
  const ui = {
    market: $("#ds-market"), markets: $("#ds-markets"), marketHint: $("#ds-market-hint"), candle: $("#ds-candle"), candleHint: $("#ds-candle-hint"),
    start: $("#ds-start"), end: $("#ds-end"), ema: $("#ds-ema"), move: $("#ds-move"), retrace: $("#ds-retrace"),
    horizon: $("#ds-horizon"), horizonUnit: $("#ds-horizon-unit"), formula: $("#ds-formula"),
    groups: $("#ds-groups"), search: $("#ds-search"), selectedHint: $("#ds-selected"), unavailable: $("#ds-unavailable"),
    plan: $("#ds-plan"), cache: $("#ds-cache"), build: $("#ds-build"), cancel: $("#ds-cancel"),
    run: $("#ds-run"), stage: $("#ds-stage"), pct: $("#ds-pct"), bar: $("#ds-bar"), progress: $("#ds-progress"), message: $("#ds-message"),
    error: $("#ds-error"), result: $("#ds-result"), filename: $("#ds-filename"), stats: $("#ds-stats"), notes: $("#ds-notes"), preview: $("#ds-preview"),
  };
  const catalogues = {}, marketLists = {};
  let exchange = "binance", preset = "optimal", custom = false, selected = new Set(), building = false, planTimer = null, planSeq = 0;

  const exchangeSeg = segmented($("#ds-exchange"), (value) => setExchange(value));
  const directionSeg = segmented($("#ds-direction"), () => changed());
  const presetSeg = segmented($("#ds-preset"), (value) => applyPreset(value));

  const today = new Date();
  const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  ui.start.value = utcDay(todayMs - 180 * DAY);
  ui.end.value = utcDay(todayMs + DAY);

  function catalogue() { return catalogues[exchange]; }
  function presetList(name) {
    const c = catalogue();
    if (!c) return [];
    return (c.presets[name] || []).filter((f) => c.byName.get(f)?.available);
  }

  async function loadCatalogue(ex) {
    if (catalogues[ex]) return catalogues[ex];
    const reply = await market.request("catalogue", { exchange: ex });
    catalogues[ex] = { ...reply, byName: new Map(reply.features.map((f) => [f.name, f])) };
    return catalogues[ex];
  }

  async function loadMarkets(ex) {
    if (marketLists[ex]) { fillMarkets(ex); return; }
    try {
      const reply = await market.request("markets", { exchange: ex });
      marketLists[ex] = reply.markets;
      fillMarkets(ex);
    } catch {
      marketLists[ex] = null;
    }
    updateMarketHint();
  }
  function fillMarkets(ex) {
    if (ex !== exchange) return;
    const list = marketLists[ex] || [];
    ui.markets.replaceChildren(...list.slice(0, 1200).map((m) => el("option", { value: m.value }, ex === "coinbase" ? `${m.base} / ${m.quote}` : m.symbol)));
  }

  function resolved() {
    const raw = ui.market.value.trim().toUpperCase();
    if (exchange === "hyperliquid") {
      const coin = hyperliquidCoin(ui.market.value);
      return coin ? { symbol: coin, label: `${coin} perpetual · Hyperliquid` } : null;
    }
    if (exchange === "binance") {
      const ticker = raw.replace(/[\s/_-]+/g, "").replace(/USDT$/, "");
      return ticker ? { symbol: `${ticker}USDT`, label: `${ticker}USDT perpetual` } : null;
    }
    const parts = raw.split(/[\s/_-]+/).filter(Boolean);
    if (!parts.length) return null;
    const symbol = `${parts[0]}-${parts[1] || "USD"}`;
    return { symbol, label: `${symbol} spot` };
  }
  function updateMarketHint() {
    const r = resolved(), list = marketLists[exchange];
    if (!r) { ui.marketHint.textContent = "Enter a market"; return; }
    const known = !list || list.some((m) => m.symbol === r.symbol);
    ui.marketHint.textContent = known ? r.label : `${r.symbol} is not listed as trading`;
    ui.marketHint.style.color = known ? "" : "var(--text-warning)";
  }
  // Earliest start date whose warm-up still fits inside Hyperliquid's latest 5,000 candles
  // (and the 1h context series for candles above 1h).
  function hyperliquidEarliestStart() {
    const minutes = INTERVAL_MIN[ui.candle.value], stepMs = minutes * 60_000, now = Date.now(), HOUR = 3_600_000, DAY = 86_400_000;
    const base = (HL_NATIVE.find((m) => m <= minutes && minutes % m === 0) || minutes) * 60_000;
    const warm = Math.max(Math.round((528 * 60) / minutes) + 50, 250, (Number(ui.ema.value) || 5) * 5);
    let oldest = Math.floor(now / base) * base - 4997 * base;
    if (minutes > 60) oldest = Math.max(oldest, Math.floor(now / HOUR) * HOUR - 4997 * HOUR);
    return Math.ceil((oldest + warm * stepMs) / DAY) * DAY;
  }
  function updateCandleHint() {
    const minutes = INTERVAL_MIN[ui.candle.value];
    for (const option of ui.candle.options) option.disabled = exchange === "hyperliquid" && INTERVAL_MIN[option.value] < 15;
    ui.start.min = "";
    if (exchange === "hyperliquid") {
      if (minutes < 15) { ui.candle.value = "15m"; updateCandleHint(); return; }
      const earliest = hyperliquidEarliestStart(), day = new Date(earliest).toISOString().slice(0, 10);
      ui.start.min = day;
      if (!ui.start.value || Date.parse(`${ui.start.value}T00:00:00Z`) < earliest) ui.start.value = day;
      const base = HL_NATIVE.find((m) => m <= minutes && minutes % m === 0);
      ui.candleHint.textContent = `${base !== minutes ? `Built from ${base >= 60 ? `${base / 60}h` : `${base}m`} candles · ` : ""}earliest start ${day}: the API keeps 5,000 candles`;
      return;
    }
    if (exchange === "coinbase" && !CB_NATIVE.includes(minutes)) {
      const base = CB_NATIVE.find((m) => m <= minutes && minutes % m === 0);
      ui.candleHint.textContent = `Built from ${base >= 60 ? `${base / 60}h` : `${base}m`} Coinbase candles`;
    } else ui.candleHint.innerHTML = "&nbsp;";
  }

  async function setExchange(ex) {
    renderChips(ex);
    const previous = exchange;
    exchange = ex;
    if (ui.market.value.trim() === "" || ui.market.value.trim().toUpperCase() === MARKET_DEFAULT[previous]) ui.market.value = MARKET_DEFAULT[ex];
    else if (previous !== ex) ui.market.value = convertMarket(ui.market.value, ex);
    ui.markets.replaceChildren();
    updateCandleHint();
    updateMarketHint();
    await loadCatalogue(ex);
    if (custom) {
      const dropped = [...selected].filter((f) => !catalogue().byName.get(f)?.available);
      dropped.forEach((f) => selected.delete(f));
      if (dropped.length) ui.unavailable.textContent = `${dropped.length} feature${dropped.length === 1 ? "" : "s"} removed: ${EXCHANGE_NAME[ex]} does not publish ${MISSING[ex]}.`;
    } else selected = new Set(presetList(preset));
    renderPresetCounts();
    renderGroups();
    changed();
    loadMarkets(ex);
  }

  function renderPresetCounts() {
    const c = catalogue();
    for (const node of document.querySelectorAll("#ds-preset .count")) node.textContent = c ? String(presetList(node.dataset.count).length) : "";
  }

  function applyPreset(name) {
    preset = name; custom = false;
    selected = new Set(presetList(name));
    ui.unavailable.textContent = "";
    renderGroups();
    changed();
  }

  // One line icon per signal category (24x24, drawn with the text colour).
  const GROUP_ICONS = {
    "Returns & position": "M3 17l6-6 4 4 8-8|M15 7h6v6", "Trend & momentum": "M3 12h4l3-8 4 16 3-8h4",
    "Volatility": "M2 9c2.5-3 4.5-3 7 0s4.5 3 7 0 4.5-3 6 0|M2 15c2.5-3 4.5-3 7 0s4.5 3 7 0 4.5-3 6 0", "Volume & flow": "M4 20V11|M10 20V4|M16 20v-7|M22 20H2",
    "Candle structure": "M8 3v3|M8 15v6|M6 6h4v9H6z|M16 4v5|M16 17v3|M14 9h4v8h-4z", "Funding": "M19 5L5 19|M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z|M17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
    "BTC context": "M9 4v16|M12 4v2|M12 18v2|M7 6h7a3 3 0 0 1 0 6H7|M7 12h8a3 3 0 0 1 0 6H7", "Calendar": "M8 2v4|M16 2v4|M3 10h18|M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
    "Holidays & events": "M4 22V4|M4 4h11l-1.5 4L15 12H4", "Astronomy": "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z|M17 3v2|M16 4h2",
    "Macro & markets": "M3 21h18|M5 18v-7|M9.5 18v-7|M14.5 18v-7|M19 18v-7|M12 3l9 5H3z", "Disasters & conflict": "M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z|M12 9v4|M12 17h.01",
  };
  function groupIcon(group) {
    const ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("class", "gicon"); svg.setAttribute("aria-hidden", "true");
    for (const d of (GROUP_ICONS[group] || "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z").split("|")) { const path = document.createElementNS(ns, "path"); path.setAttribute("d", d); svg.append(path); }
    return svg;
  }

  // Where world data comes from: fetched live in the browser when the dataset is built. Nothing to install.
  function dataNote(group) {
    if (group === "Macro & markets") return el("p", { class: "fnote", text: "Loaded live in your browser when you build. Rates and jobs: Federal Reserve and BLS via DBnomics. Oil, gas, inflation, the dollar, VIX, the S&P 500 and gold: DataHub (EIA, BLS, Federal Reserve, Cboe, Shiller)." });
    if (group === "Disasters & conflict") return el("p", { class: "fnote", text: "Loaded live in your browser when you build: earthquakes from USGS, tropical storms from NASA EONET, war attention from Wikipedia. Each has years of history." });
    return null;
  }

  function renderGroups() {
    const c = catalogue();
    if (!c) return;
    const groups = new Map();
    for (const f of c.features) {
      if (!groups.has(f.group)) groups.set(f.group, []);
      groups.get(f.group).push(f);
    }
    const q = ui.search.value.trim().toLowerCase();
    ui.groups.replaceChildren(...[...groups.entries()].map(([group, features]) => {
      const items = features.map((f) => {
        const input = el("input", { type: "checkbox", value: f.name, checked: selected.has(f.name), disabled: !f.available });
        // !! keeps an empty search from setting the hidden attribute (an empty string would hide every signal).
        const hidden = !!q && !featureTitle(f.name).toLowerCase().includes(q) && !group.toLowerCase().includes(q);
        const why = f.available ? f.note : /data/.test(f.requires || "") ? `Needs ${f.requires}.` : `Not published by ${EXCHANGE_NAME[exchange]} (${f.requires})`;
        return el("label", { class: `fitem${f.available ? "" : " off"}`, title: why, hidden }, input, el("span", { class: "fname" }, featureLabel(f.name), " ", el("span", { class: "fcode", text: `(${f.name})` })));
      });
      const visible = items.filter((i) => !i.hidden).length;
      // The category tick selects or clears every signal in it (only the ones shown while searching).
      const toggleable = features.filter((f, k) => f.available && !items[k].hidden), on = toggleable.filter((f) => selected.has(f.name)).length;
      const tick = el("input", { type: "checkbox", class: "gtick", "aria-label": `Select every ${group} signal${q ? " shown" : ""}`, checked: toggleable.length > 0 && on === toggleable.length, disabled: !toggleable.length });
      tick.indeterminate = on > 0 && on < toggleable.length;
      const head = el("label", { class: "ghead", title: q ? "Select or clear the signals shown in this category" : "Select or clear every signal in this category" }, tick, groupIcon(group), el("span", { text: group }));
      const box = el("div", { class: "fgroup", hidden: visible === 0 }, el("h4", {}, head, el("span", { class: "muted", text: `${features.filter((f) => selected.has(f.name)).length}/${features.filter((f) => f.available).length}` })), dataNote(group, features, c), ...items);
      return box;
    }));
    const unavailableCount = c.features.filter((f) => !f.available && !/data/.test(f.requires || "")).length;
    if (!ui.unavailable.textContent && unavailableCount) ui.unavailable.textContent = `${unavailableCount} features need ${MISSING[exchange]}, which ${EXCHANGE_NAME[exchange]} does not publish.`;
    if (!unavailableCount && !custom) ui.unavailable.textContent = "";
    updateSelectedHint();
  }

  function updateSelectedHint() {
    ui.selectedHint.textContent = `${custom ? "Custom" : preset[0].toUpperCase() + preset.slice(1)} · ${selected.size} selected`;
  }

  ui.groups.addEventListener("change", (event) => {
    const input = event.target.closest("input[type=checkbox]");
    if (!input) return;
    if (input.classList.contains("gtick")) {
      for (const cb of input.closest(".fgroup").querySelectorAll("label.fitem:not([hidden]) input:not(:disabled)")) { if (input.checked) selected.add(cb.value); else selected.delete(cb.value); }
    } else if (input.checked) selected.add(input.value); else selected.delete(input.value);
    custom = true;
    for (const b of presetSeg.buttons) b.setAttribute("aria-checked", "false");
    renderGroups();
    changed();
  });
  ui.search.addEventListener("input", () => renderGroups());
  const bulk = (on) => {
    for (const input of ui.groups.querySelectorAll("label.fitem:not([hidden]) input:not(:disabled)")) {
      if (input.closest(".fgroup")?.hidden) continue;
      if (on) selected.add(input.value); else selected.delete(input.value);
    }
    custom = true;
    for (const b of presetSeg.buttons) b.setAttribute("aria-checked", "false");
    renderGroups();
    changed();
  };
  $("#ds-select-shown").addEventListener("click", () => bulk(true));
  $("#ds-clear-shown").addEventListener("click", () => bulk(false));

  function horizon() {
    const minutes = INTERVAL_MIN[ui.candle.value], value = Number(ui.horizon.value), unit = ui.horizonUnit.value;
    if (!Number.isFinite(value) || value <= 0) return { bars: NaN, text: "" };
    if (unit === "bars") return { bars: Math.round(value), text: horizonLabel(Math.round(value), ui.candle.value), exact: Number.isInteger(value) };
    const total = value * { minutes: 1, hours: 60, days: 1440 }[unit];
    const bars = Math.max(1, Math.round(total / minutes));
    const short = { minutes: "m", hours: "h", days: "d" }[unit];
    return { bars, text: `${value}${short}`, exact: total % minutes === 0 };
  }

  function job() {
    const r = resolved(), h = horizon();
    const startMs = Date.parse(`${ui.start.value}T00:00:00Z`), endMs = Date.parse(`${ui.end.value}T00:00:00Z`);
    return {
      exchange, market: ui.market.value.trim(), symbol: r?.symbol, candle: ui.candle.value, startMs, endMs,
      direction: directionSeg.value, basePeriod: Number(ui.ema.value), movePct: Number(ui.move.value), retracePct: Number(ui.retrace.value),
      moveText: ui.move.value.trim(), retraceText: ui.retrace.value.trim(), horizonBars: h.bars, horizonText: h.text,
      preset: custom ? "custom" : preset, features: [...selected], cacheCandles: ui.cache.checked,
    };
  }

  function validate(j) {
    if (!j.symbol) return "Enter a market";
    if (!Number.isFinite(j.startMs) || !Number.isFinite(j.endMs) || j.endMs <= j.startMs) return "End must be after start";
    if (!Number.isInteger(j.basePeriod) || j.basePeriod < 1 || j.basePeriod > 200) return "EMA baseline must be 1–200";
    if (!(j.movePct > 0) || (j.direction === "down" && j.movePct >= 100)) return "Move must be above 0%";
    if (!(j.retracePct >= 0 && j.retracePct < 100)) return "Stop must be 0–99%";
    if (!Number.isInteger(j.horizonBars) || j.horizonBars < 1) return "Horizon must be at least one candle";
    if (!j.features.length) return "Select at least one feature";
    return null;
  }

  function renderFormula() {
    const j = job(), up = j.direction === "up", h = horizon();
    if (!(j.movePct > 0) || !(j.retracePct >= 0) || !Number.isFinite(h.bars)) { ui.formula.textContent = "Enter a valid target."; return; }
    const t = up ? 1 + j.movePct / 100 : 1 - j.movePct / 100, s = up ? 1 - j.retracePct / 100 : 1 + j.retracePct / 100;
    ui.formula.textContent = `label = 1 when ${up ? "high ≥" : "low ≤"} EMA${j.basePeriod} × ${t.toFixed(4)} before ${up ? "low ≤" : "high ≥"} EMA${j.basePeriod} × ${s.toFixed(4)} within ${h.bars} candle${h.bars === 1 ? "" : "s"}${h.exact === false ? " (rounded)" : ""} · stop wins ties`;
  }

  function changed() {
    renderFormula();
    drawExtras();
    updateSelectedHint();
    clearTimeout(planTimer);
    planTimer = setTimeout(plan, 250);
  }

  async function plan() {
    const j = job(), problem = validate(j);
    if (problem) { ui.plan.textContent = problem; ui.build.disabled = true; return; }
    ui.build.disabled = building;
    const seq = ++planSeq;
    try {
      const { plan: p } = await market.request("cachePlan", { job: j });
      if (seq !== planSeq) return;
      const download = p.requests ? `${fmtInt(p.requests)} request${p.requests === 1 ? "" : "s"} to ${EXCHANGE_NAME[exchange]}` : "all candles cached";
      ui.plan.textContent = `≈ ${fmtInt(p.exportRowsEstimate)} rows · ${fmtInt(p.requiredRows)} candles with warm-up · ${download}`;
    } catch (error) {
      if (seq === planSeq) ui.plan.textContent = error.message;
    }
  }

  for (const input of [ui.candle, ui.start, ui.end, ui.ema, ui.move, ui.retrace, ui.horizon, ui.horizonUnit, ui.cache]) input.addEventListener("input", changed);
  ui.candle.addEventListener("change", () => { updateCandleHint(); changed(); });
  ui.market.addEventListener("input", () => { updateMarketHint(); changed(); });

  function setBusy(on) {
    building = on;
    ui.build.disabled = on;
    ui.cancel.hidden = !on;
    ui.run.hidden = !on && !ui.run.dataset.keep;
    for (const b of [...exchangeSeg.buttons, ...presetSeg.buttons]) b.disabled = on;
  }

  async function build() {
    const j = job(), problem = validate(j);
    if (problem) { showError(ui.error, problem); return; }
    if (market.busy) { showError(ui.error, "Wait for the running inference to finish."); return; }
    showError(ui.error, null);
    ui.result.hidden = true;
    ui.run.hidden = false;
    setBusy(true);
    ui.stage.textContent = "Starting"; ui.message.textContent = "";
    setProgress(ui.bar, ui.progress, 0); ui.pct.textContent = "0%";
    try {
      const result = await market.request("build", { job: j }, {
        onProgress: (m) => {
          const pct = setProgress(ui.bar, ui.progress, m.value);
          ui.pct.textContent = `${pct}%`;
          ui.stage.textContent = { prepare: "Preparing", fetch: "Downloading candles", features: "Computing features", label: "Labelling", validate: "Auditing", export: "Writing CSV", done: "Done" }[m.stage] || m.stage;
          if (m.message) ui.message.textContent = m.message;
        },
        onLog: (m) => { if (m.level === "warn") ui.message.textContent = m.message; },
      });
      const profile = await buildProfile(result, ctx.runtime);
      state.dataset = {
        origin: "built", filename: result.filename, blob: result.blob, profile, stats: result.stats,
        header: result.header, matrix: result.matrix, cache: result.cache, sources: result.sources,
      };
      renderResult(result, profile);
      ctx.emit("dataset", state.dataset);
      ctx.stepStatus("dataset", `${profile.symbol} · ${profile.candle} · ${fmtInt(result.stats.rows)} rows`, true);
      ui.run.hidden = true;
      plan();
    } catch (error) {
      ui.run.hidden = true;
      if (error.name !== "AbortError") showError(ui.error, humanize(error));
    } finally {
      setBusy(false);
      ui.run.hidden = true;
    }
  }

  function humanize(error) {
    const text = String(error?.message || error);
    if (/Failed to fetch|NetworkError|network or CORS/i.test(text)) return `${EXCHANGE_NAME[exchange]} could not be reached from this browser. Check the connection, VPN or regional access, then retry.`;
    if (/HTTP 451|HTTP 403/.test(text)) return `${EXCHANGE_NAME[exchange]} refused requests from this region (${text.match(/HTTP \d+/)[0]}).`;
    if (/HTTP 404|NotFound/i.test(text)) return `Market not found on ${EXCHANGE_FULL[exchange]}. Check the symbol.`;
    return text;
  }

  function renderResult(result, profile) {
    const s = result.stats;
    ui.filename.textContent = result.filename;
    renderStats(ui.stats, [
      { label: "Rows", value: fmtInt(s.rows) },
      { label: "Features", value: fmtInt(s.features) },
      { label: "Class 1", value: `${s.posPct.toFixed(1)}%` },
      { label: `First candle · ${s.firstTime.slice(11, 16)} UTC`, value: s.firstTime.slice(0, 10) },
      { label: `Last candle · ${s.lastTime.slice(11, 16)} UTC`, value: s.lastTime.slice(0, 10) },
      { label: "CSV size", value: fmtBytes(result.blob.size) },
    ]);
    const notes = [targetLabel(profile.label, profile.candle)];
    if (s.removed?.length) notes.push(`${s.removed.length} column${s.removed.length === 1 ? "" : "s"} removed by the quantization audit (${s.removed.slice(0, 3).map((r) => r.name).join(", ")}${s.removed.length > 3 ? "…" : ""})`);
    if (result.cache?.synthetic) notes.push(`${fmtInt(result.cache.synthetic)} no-trade ${EXCHANGE_NAME[exchange]} candles filled with the previous close`);
    if (result.cache?.reusedRows) notes.push(`${fmtInt(result.cache.reusedRows)} candles reused from the local cache`);
    drawDatasetChart(result, profile);
    ui.notes.textContent = notes.join(" · ");
    const cols = Math.min(result.header.length - 1, 7);
    const header = [...result.header.slice(0, cols), "…", "label"];
    table(ui.preview, header, (result.preview || []).map((row) => [...row.slice(0, cols).map((v, i) => (i === 0 ? v.slice(0, 16) : v)), "…", row[row.length - 1]]));
    ui.result.hidden = false;
    ui.result.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  ui.build.addEventListener("click", build);
  ui.cancel.addEventListener("click", () => market.cancel());
  $("#ds-download-csv").addEventListener("click", () => state.dataset?.blob && downloadBlob(state.dataset.filename, state.dataset.blob));
  $("#ds-download-profile").addEventListener("click", () => state.dataset?.profile && downloadJson(state.dataset.filename.replace(/\.csv$/, ".profile.json"), state.dataset.profile));
  $("#ds-to-train").addEventListener("click", () => ctx.goTo("train"));

  ctx.on("step", (step) => { if (step === "dataset") plan(); });

  // ---------- extras: chips, live label diagram, recipe, dataset chart, URL prefill ----------
  const CHIPS = { binance: ["BTC", "ETH", "SOL", "XRP", "DOGE", "1000PEPE", "WIF", "1000BONK"], coinbase: ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "DOGE-USD", "LINK-USD"], hyperliquid: ["BTC", "ETH", "SOL", "HYPE", "kPEPE", "WIF", "DOGE", "kBONK"] };
  function renderChips(ex) {
    const box = $("#ds-chips");
    if (!box) return;
    box.replaceChildren(...CHIPS[ex].map((m) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = m;
      b.addEventListener("click", () => { ui.market.value = m; ui.market.dispatchEvent(new Event("input", { bubbles: true })); ui.market.dispatchEvent(new Event("change", { bubbles: true })); });
      return b;
    }));
  }
  function drawExtras() {
    const j = job(), h = horizon(), chart = $("#ds-label-chart");
    if (chart && j.movePct > 0 && j.retracePct >= 0 && Number.isFinite(h.bars)) {
      labelDiagram(chart, { direction: j.direction, basePeriod: j.basePeriod, movePct: j.movePct, retracePct: j.retracePct, horizonBars: h.bars, horizonText: h.text });
    }
    const r = resolved(), recipe = $("#ds-recipe");
    if (recipe) setKVList(recipe, [
      ["Market", r ? `${r.symbol} · ${EXCHANGE_FULL[exchange]}` : "—"],
      ["Candle", ui.candle.value],
      ["Range", `${ui.start.value} → ${ui.end.value}`],
      ["Question", `${j.direction === "up" ? "+" : "−"}${j.moveText || "?"}% before ${j.direction === "up" ? "−" : "+"}${j.retraceText || "?"}% · ${h.text || "?"}`],
      ["Signals", `${selected.size} · ${custom ? "custom" : preset}`],
    ]);
  }
  function drawDatasetChart(result, profile) {
    const box = $("#ds-chart"), mx = result.matrix;
    if (!box || !mx?.close || !mx.times) return;
    const n = mx.nRows || mx.times.length, buckets = Math.min(160, n), per = n / buckets, sx = [], sv = [];
    for (let b = 0; b < buckets; b++) {
      const from = Math.floor(b * per), to = Math.max(from + 1, Math.floor((b + 1) * per));
      let pos = 0;
      for (let i = from; i < to; i++) pos += mx.y[i] ? 1 : 0;
      sx.push(mx.times[from]); sv.push(pos / (to - from));
    }
    const maxV = Math.max(1e-9, ...sv);
    timeChart(box, { series: [{ name: profile.symbol, x: mx.times, y: mx.close, cls: "c-accent", area: true, width: 1.8 }], strip: { x: sx, v: sv.map((v) => v / maxV), cls: "f-good" }, yFormat: (v) => (v >= 100 ? v.toFixed(0) : v.toPrecision(4)) });
  }
  function prefillFromUrl() {
    const q = new URLSearchParams(location.search);
    const ex = ["coinbase", "hyperliquid"].includes(q.get("ex")) ? q.get("ex") : "binance";
    if (q.get("m")) ui.market.value = ex === "hyperliquid" ? hyperliquidCoin(q.get("m")) : q.get("m").trim().toUpperCase();
    else if (ex === "coinbase") ui.market.value = "ETH-USD";
    if (q.get("c") && [...ui.candle.options].some((o) => o.value === q.get("c"))) ui.candle.value = q.get("c");
    if (q.get("dir") === "down" || q.get("dir") === "up") directionSeg.set(q.get("dir"));
    for (const [key, input] of [["move", ui.move], ["stop", ui.retrace], ["h", ui.horizon], ["ema", ui.ema]]) if (q.get(key) && Number.isFinite(Number(q.get(key)))) input.value = q.get(key);
    if (["minutes", "hours", "days", "bars"].includes(q.get("hu"))) ui.horizonUnit.value = q.get("hu");
    for (const [key, input] of [["start", ui.start], ["end", ui.end]]) if (/^\d{4}-\d{2}-\d{2}$/.test(q.get(key) || "")) input.value = q.get(key);
    if (["small", "optimal", "full", "all"].includes(q.get("preset"))) { preset = q.get("preset"); presetSeg.set(preset); }
    return ex;
  }
  exchange = prefillFromUrl();
  exchangeSeg.set(exchange);
  renderChips(exchange);
  loadCatalogue(exchange).then(() => {
    selected = new Set(presetList(preset));
    renderPresetCounts();
    renderGroups();
    updateCandleHint();
    changed();
  }).catch((error) => showError(ui.error, error));
  loadMarkets(exchange);
  renderFormula();
}
