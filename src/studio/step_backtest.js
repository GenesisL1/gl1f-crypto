// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Step 3 — Backtest. The worker replays the model's exact features over a range (same engine and
// seed as the dataset); the page scores every candle with the same integer trees and simulates the
// trades the label describes: enter at the next open, exit at target, stop or horizon close.
// Educational simulation only.
import { $, fmtInt, fmtPct, fmtPrice, fmtUtc, renderStats, setPill, setProgress, showError, segmented, downloadText, csvCell, table } from "./ui.js";
import { predictQ } from "./local_infer.js";
import { INTERVAL_MIN, marketLabel, targetLabel } from "./profile.js";
import { timeChart, barsHtml } from "./charts.js";

const DAY = 86_400_000;
const FEE_DEFAULT = { binance: 0.05, coinbase: 0.4, hyperliquid: 0.045 };
const SWEEP = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8];

// Pure trade simulation over replayed candles `bt` and per-candle probabilities `prob`.
export function simulate(bt, prob, { threshold, feePct, slipBps, direction, movePct, retracePct, horizonBars, leverage = 1, marginPct = 100, mmrPct = 0.5 }) {
  const n = bt.nRows, up = direction !== "down", H = Math.max(1, Math.floor(horizonBars));
  const fee = Math.max(0, feePct) / 100, slip = Math.max(0, slipBps) / 10_000, m = movePct / 100, r = retracePct / 100;
  const L = Math.min(125, Math.max(1, Number(leverage) || 1)), alloc = Math.min(1, Math.max(0.01, (Number(marginPct) || 100) / 100));
  const mmr = Math.min(0.2, Math.max(0, Number(mmrPct) || 0) / 100);
  // Adverse move, as a fraction of the entry price, that wipes out the margin (isolated margin, linear contract).
  const liqDist = L > 1 ? Math.max(0.0005, 1 / L - mmr) : Infinity;
  const synthetic = bt.synthetic || null;
  const trades = [], equity = new Float64Array(n);
  let eq = 1, held = 0, signals = 0, i = 0, skipTarget = 0, skipStop = 0, skipUntradable = 0, liquidations = 0, bankrupt = false;
  for (let k = 0; k < n; k++) if (prob[k] >= threshold) signals++;
  while (i < n) {
    equity[i] = eq;
    const p = prob[i], base = bt.baseline[i];
    if (bankrupt || !(p >= threshold) || !Number.isFinite(base)) { i++; continue; }
    // No look-ahead: the signal exists only after candle i has closed, so the earliest price anyone could trade
    // is the open of candle i + 1. That candle must exist and must have traded (gap-filled buckets had no trades).
    const j = i + 1;
    if (j >= n || (synthetic && synthetic[j]) || !(bt.open[j] > 0)) { skipUntradable++; i++; continue; }
    const last = Math.min(n - 1, j + H - 1);
    const target = up ? base * (1 + m) : base * (1 - m), stop = up ? base * (1 - r) : base * (1 + r);
    const entryRaw = bt.open[j], entry = up ? entryRaw * (1 + slip) : entryRaw * (1 - slip);
    // The entry must still sit strictly between the stop and the target this signal defined; otherwise no trade.
    if (up ? entryRaw >= target : entryRaw <= target) { skipTarget++; i++; continue; }
    if (up ? entryRaw <= stop : entryRaw >= stop) { skipStop++; i++; continue; }
    const liq = up ? entry * (1 - liqDist) : entry * (1 + liqDist);
    // Whichever protective level is closer to the entry is reached first.
    const guardIsLiq = up ? liq >= stop : liq <= stop, guard = guardIsLiq ? liq : stop;
    let k = j, exitRaw = NaN, outcome = "";
    for (; k <= last; k++) {
      const o = bt.open[k], hi = bt.high[k], lo = bt.low[k];
      if (up) {
        if (o <= liq) { exitRaw = o; outcome = "liquidated"; break; }
        if (o <= stop) { exitRaw = o; outcome = "stop"; break; }
        if (o >= target) { exitRaw = o; outcome = "target"; break; }
        if (lo <= guard) { exitRaw = guard; outcome = guardIsLiq ? "liquidated" : "stop"; break; }
        if (hi >= target) { exitRaw = target; outcome = "target"; break; }
      } else {
        if (o >= liq) { exitRaw = o; outcome = "liquidated"; break; }
        if (o >= stop) { exitRaw = o; outcome = "stop"; break; }
        if (o <= target) { exitRaw = o; outcome = "target"; break; }
        if (hi >= guard) { exitRaw = guard; outcome = guardIsLiq ? "liquidated" : "stop"; break; }
        if (lo <= target) { exitRaw = target; outcome = "target"; break; }
      }
    }
    if (!outcome) { k = last; exitRaw = bt.close[last]; outcome = last === j + H - 1 ? "timeout" : "end"; }
    const exit = outcome === "liquidated" ? exitRaw : up ? exitRaw * (1 - slip) : exitRaw * (1 + slip);
    const gross = up ? exit / entry - 1 : (entry - exit) / entry;
    let net;
    if (outcome === "liquidated") { net = -1; liquidations++; }
    else if (L === 1) net = (1 + gross) * (1 - fee) * (1 - fee) - 1;
    else net = Math.max(-1, L * gross - fee * L * (1 + exit / entry));   // return on margin; fees on both notionals
    for (let x = i + 1; x < k; x++) equity[x] = eq;
    eq *= 1 + alloc * net;
    if (eq <= 1e-9) { eq = 0; bankrupt = true; }
    equity[k] = eq;
    held += k - j + 1;
    trades.push({ signalTime: bt.times[i], entryTime: bt.times[j], exitTime: bt.times[k], prob: p, entry, exit, outcome, gross, net, leverage: L, bars: k - j + 1, entryIndex: j });
    i = k;
  }
  let peak = -Infinity, mdd = 0;
  for (let x = 0; x < n; x++) { peak = Math.max(peak, equity[x]); mdd = Math.max(mdd, peak > 0 ? 1 - equity[x] / peak : 0); }
  const wins = trades.filter((t) => t.net > 0), losses = trades.filter((t) => t.net <= 0);
  const sumWin = wins.reduce((a, t) => a + t.net, 0), sumLoss = -losses.reduce((a, t) => a + t.net, 0);
  const count = (o) => trades.filter((t) => t.outcome === o).length;
  return {
    trades, equity, signals,
    stats: {
      totalReturn: eq - 1, buyHold: bt.close[n - 1] / bt.open[0] - 1, trades: trades.length, winRate: trades.length ? wins.length / trades.length : NaN,
      profitFactor: sumLoss > 0 ? sumWin / sumLoss : (sumWin > 0 ? Infinity : NaN), maxDrawdown: mdd,
      avgTrade: trades.length ? trades.reduce((a, t) => a + t.net, 0) / trades.length : NaN, exposure: held / n,
      avgBars: trades.length ? held / trades.length : NaN, leverage: L, marginPct: alloc * 100, liqDist, liquidations, bankrupt,
      outcomes: { target: count("target"), stop: count("stop"), liquidated: liquidations, timeout: count("timeout"), end: count("end") },
      skipped: { target: skipTarget, stop: skipStop, untradable: skipUntradable },
    },
  };
}

export function initBacktest(ctx) {
  const { state, market } = ctx;
  const ui = {
    pill: $("#bt-pill"), empty: $("#bt-empty"), ready: $("#bt-ready"), title: $("#bt-model-title"), sub: $("#bt-model-sub"),
    start: $("#bt-start"), end: $("#bt-end"), market: $("#bt-market"), marketHint: $("#bt-market-hint"), insample: $("#bt-insample"),
    threshold: $("#bt-threshold"), fee: $("#bt-fee"), slip: $("#bt-slip"), rules: $("#bt-rules"), plan: $("#bt-plan"),
    leverage: $("#bt-leverage"), margin: $("#bt-margin"), mmr: $("#bt-mmr"), liqHint: $("#bt-liq-hint"),
    run: $("#bt-run"), cancel: $("#bt-cancel"), box: $("#bt-run-box"), stage: $("#bt-stage"), pct: $("#bt-pct"), bar: $("#bt-bar"),
    progress: $("#bt-progress"), message: $("#bt-message"), error: $("#bt-error"), result: $("#bt-result"), period: $("#bt-period"),
    warn: $("#bt-warn"), stats: $("#bt-stats"), equity: $("#bt-equity"), price: $("#bt-price"), outcomes: $("#bt-outcomes"),
    sweep: $("#bt-sweep"), trades: $("#bt-trades"), tradesHint: $("#bt-trades-hint"), download: $("#bt-download"),
  };
  let source = "session", running = false, last = null, currentModel = null, feeTouched = false, range = "test";
  const sourceSeg = segmented($("#bt-source"), (v) => { source = v; refresh(); });
  const rangeSeg = segmented($("#bt-range"), (v) => { range = v; applyRange(); });
  const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);
  const today = () => { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };

  function model() { return source === "infer" ? state.inferModel : state.model; }
  function profile(m) { return m?.profile || null; }

  function setDisabled(value, disabled) { const b = sourceSeg.buttons.find((x) => x.dataset.value === value); if (b) b.disabled = disabled; }

  function refresh() {
    setDisabled("session", !state.model);
    setDisabled("infer", !state.inferModel);
    if (!model()) {
      const other = source === "infer" ? "session" : "infer";
      if ((other === "infer" ? state.inferModel : state.model)) { source = other; sourceSeg.set(other); }
    }
    const m = model(), p = profile(m);
    ui.empty.hidden = !!m; ui.ready.hidden = !m;
    if (!m) { setPill(ui.pill, "No model"); ctx.stepStatus("backtest", "No model yet"); return; }
    const changedModel = m !== currentModel;
    currentModel = m;
    ui.title.textContent = m.title || (p ? `${marketLabel(p)} model` : "Model");
    ui.sub.textContent = p ? `${marketLabel(p)} · ${p.candle} · ${p.label ? targetLabel(p.label, p.candle) : "no target in profile"}` : "No input profile";
    const testable = !!(p?.label && p.exchange && p.candle);
    ui.run.disabled = !testable || running;
    if (!testable) {
      setPill(ui.pill, "Needs a profile", "warn");
      showError(ui.error, "This model has no market profile with a target definition, so its trades can't be simulated. Models trained here or published from this runtime include one.");
      return;
    }
    showError(ui.error, null);
    setPill(ui.pill, last && last.model === m ? "Results ready" : "Ready", last && last.model === m ? "ok" : "");
    if (changedModel) {
      ui.market.value = p.symbol || "";
      if (!feeTouched) ui.fee.value = String(FEE_DEFAULT[p.exchange] ?? 0.1);
      const hasTest = !!m.testPeriod;
      const testBtn = rangeSeg.buttons.find((b) => b.dataset.value === "test");
      testBtn.disabled = !hasTest;
      if (!hasTest && range === "test") { range = "30"; rangeSeg.set("30"); }
      if (hasTest && source === "session") { range = "test"; rangeSeg.set("test"); }
      applyRange();
    }
    renderRules();
  }

  function rangeMs() {
    const m = model();
    if (range === "test" && m?.testPeriod) return { startMs: m.testPeriod.startMs, endMs: m.testPeriod.endMs };
    if (range === "30" || range === "90") { const end = today() + DAY; return { startMs: end - Number(range) * DAY, endMs: end }; }
    return { startMs: Date.parse(`${ui.start.value}T00:00:00Z`), endMs: Date.parse(`${ui.end.value}T00:00:00Z`) };
  }

  function applyRange() {
    const custom = range === "custom", { startMs, endMs } = rangeMs();
    ui.start.disabled = !custom; ui.end.disabled = !custom;
    if (!custom && Number.isFinite(startMs)) { ui.start.value = utcDay(startMs); ui.end.value = utcDay(endMs + DAY - 1); }
    checkInSample();
    renderRules();
  }

  function checkInSample() {
    const m = model(), { startMs, endMs } = rangeMs();
    let text = "";
    if (m?.testPeriod && m.trainStartMs !== undefined && startMs < m.testPeriod.startMs && endMs > m.trainStartMs) {
      text = `This period overlaps the data the model was trained on (before ${fmtUtc(m.testPeriod.startMs)}). In-sample results look better than reality.`;
    } else if (source === "infer" && m && !m.testPeriod) {
      text = "The training period of this model isn't known here. If your range overlaps it, the results will be flattering.";
    }
    ui.insample.textContent = text; ui.insample.hidden = !text;
  }

  function renderRules() {
    const m = model(), p = profile(m);
    if (!p?.label) { ui.rules.textContent = ""; return; }
    const L = p.label, up = L.direction !== "down", thr = Number(ui.threshold.value);
    const lev = leverageOpts(p);
    ui.rules.textContent = `${up ? "Long" : "Short"} ${lev.leverage}× when P ≥ ${Number.isFinite(thr) ? thr.toFixed(2) : "?"} at a candle close → enter at the next candle's open, only if that candle traded and its open is still between stop and target · target ${up ? "+" : "−"}${L.movePct}% / stop ${up ? "−" : "+"}${L.retracePct}% from EMA${L.basePeriod} · exit at target, stop${lev.leverage > 1 ? ", liquidation" : ""} or the close of candle ${L.horizonBars} · stop first when both are touched in one candle · one position at a time.`;
    const liqPct = lev.leverage > 1 ? Math.max(0.05, 100 / lev.leverage - lev.mmrPct) : null;
    ui.liqHint.textContent = p.exchange === "coinbase" ? "Spot market: no leverage." : liqPct === null ? "No leverage: no liquidation." :
      `${lev.leverage}×: liquidation ≈ ${liqPct.toFixed(2)}% against the entry.${liqPct <= L.retracePct ? ` That is inside your ${L.retracePct}% stop, so liquidation comes first.` : ` Your ${L.retracePct}% stop triggers first.`}`;
    ui.liqHint.style.color = liqPct !== null && liqPct <= L.retracePct ? "var(--bad)" : "";
    const { startMs, endMs } = rangeMs(), minutes = INTERVAL_MIN[p.candle];
    ui.plan.textContent = Number.isFinite(startMs) && endMs > startMs ? `≈ ${fmtInt(Math.round((endMs - startMs) / (minutes * 60_000)))} candles to replay` : "Choose a valid period";
  }

  function leverageOpts(p) {
    const spot = p?.exchange === "coinbase";
    ui.leverage.disabled = spot;
    if (spot) ui.leverage.value = "1";
    return { leverage: spot ? 1 : Math.min(125, Math.max(1, Number(ui.leverage.value) || 1)), marginPct: Math.min(100, Math.max(1, Number(ui.margin.value) || 100)), mmrPct: Math.min(20, Math.max(0, Number(ui.mmr.value) || 0)) };
  }

  function setBusy(on) {
    running = on;
    ui.run.disabled = on; ui.cancel.hidden = !on; ui.box.hidden = !on;
  }

  async function run() {
    const m = model(), p = profile(m);
    if (!m || !p?.label) return;
    if (market.busy) { showError(ui.error, "Wait for the running job to finish."); return; }
    const { startMs, endMs } = rangeMs();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) { showError(ui.error, "End must be after start."); return; }
    const threshold = Number(ui.threshold.value), feePct = Number(ui.fee.value), slipBps = Number(ui.slip.value);
    if (!(threshold > 0 && threshold < 1)) { showError(ui.error, "Threshold must be between 0 and 1."); return; }
    if (!(feePct >= 0 && feePct <= 5) || !(slipBps >= 0 && slipBps <= 500)) { showError(ui.error, "Check the fee and slippage values."); return; }
    const symbolInput = ui.market.value.trim() || p.symbol, sameMarket = !symbolInput || symbolInput.toUpperCase() === String(p.symbol || "").toUpperCase();
    const job = {
      exchange: p.exchange, market: symbolInput, candle: p.candle, features: m.featureNames, featureFamily: p.featureFamily || "auto",
      scaleQ: m.decoded.scaleQ, warmupBars: p.warmupBars || null, featureSeedStartMs: sameMarket ? p.featureSeedStartMs : null,
      basePeriod: p.label.basePeriod, startMs, endMs, btcSymbol: sameMarket ? p.btcContext : undefined, cacheCandles: true,
    };
    showError(ui.error, null); ui.result.hidden = true; setBusy(true);
    setPill(ui.pill, "Replaying…", "busy");
    ui.stage.textContent = "Starting"; ui.message.textContent = ""; setProgress(ui.bar, ui.progress, 0); ui.pct.textContent = "0%";
    try {
      const bt = await market.request("backtest", { job }, {
        onProgress: (msg) => {
          const pct = setProgress(ui.bar, ui.progress, msg.value * 0.8);
          ui.pct.textContent = `${pct}%`;
          ui.stage.textContent = { prepare: "Preparing", fetch: "Downloading candles", features: "Replaying features", ready: "Scoring" }[msg.stage] || "Working";
          if (msg.message) ui.message.textContent = msg.message;
        },
        onLog: (msg) => { if (msg.level === "warn") ui.message.textContent = msg.message; },
      });
      ui.stage.textContent = "Scoring every candle";
      const prob = new Float64Array(bt.nRows).fill(NaN), F = bt.nFeatures, row = new Array(F), scale = m.decoded.scaleQ;
      for (let r = 0; r < bt.nRows; r++) {
        if (bt.valid[r]) {
          for (let j = 0; j < F; j++) row[j] = bt.X[r * F + j];
          prob[r] = 1 / (1 + Math.exp(-Number(predictQ(m.decoded, row)) / scale));
        }
        if (r % 4000 === 3999) {
          const pct = setProgress(ui.bar, ui.progress, 0.8 + 0.2 * (r / bt.nRows)); ui.pct.textContent = `${pct}%`;
          await new Promise((res) => setTimeout(res, 0));
        }
      }
      const opts = { threshold, feePct, slipBps, ...p.label, ...leverageOpts(p) };
      const sim = simulate(bt, prob, opts);
      const sweep = SWEEP.map((t) => ({ t, ...simulate(bt, prob, { ...opts, threshold: t }).stats }));
      last = { model: m, bt, prob, sim, sweep, opts, symbol: bt.symbol, job };
      render(last);
      setPill(ui.pill, "Results ready", "ok");
      ctx.stepStatus("backtest", `${fmtPct(sim.stats.totalReturn)} · ${fmtInt(sim.stats.trades)} trades`, true);
      ctx.emit("backtest", last);
    } catch (error) {
      setPill(ui.pill, error.name === "AbortError" ? "Stopped" : "Failed", error.name === "AbortError" ? "" : "bad");
      if (error.name !== "AbortError") showError(ui.error, humanize(error, p.exchange));
    } finally {
      setBusy(false);
    }
  }

  function humanize(error, exchange) {
    const text = String(error?.message || error), name = { coinbase: "Coinbase", hyperliquid: "Hyperliquid" }[exchange] || "Binance";
    if (/Failed to fetch|NetworkError|network or CORS/i.test(text)) return `${name} could not be reached from this browser. Check the connection, VPN or region.`;
    if (/HTTP 451|HTTP 403/.test(text)) return `${name} refused requests from this region.`;
    return text;
  }

  const pct = (v, d = 1) => (Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%` : "—");

  function render({ bt, sim, sweep, opts, model: m }) {
    const s = sim.stats, n = bt.nRows;
    ui.period.textContent = `${bt.symbol} · ${fmtUtc(bt.startMs)} → ${fmtUtc(bt.times[n - 1])} · ${fmtInt(n)} candles`;
    const warns = [];
    if (!ui.insample.hidden) warns.push(ui.insample.textContent);
    if (s.bankrupt) warns.push("The account was wiped out: equity reached zero and trading stopped. Lower the leverage or the margin per trade.");
    if (bt.startMoved) warns.push("The start was moved forward to the first candle with fully warmed-up signals.");
    if (s.trades < 30) warns.push(`Only ${s.trades} trade${s.trades === 1 ? "" : "s"}: far too few to trust these percentages.`);
    if (s.skipped.target > s.trades) warns.push(`${fmtInt(s.skipped.target)} signals came when price was already past the target, so there was nothing left to gain. The model may be learning an easy question; try a bigger target or a longer EMA baseline.`);
    if (bt.skipped) warns.push(`${fmtInt(bt.skipped)} candle${bt.skipped === 1 ? "" : "s"} skipped because a signal was not computable.`);
    ui.warn.textContent = warns.join(" "); ui.warn.hidden = !warns.length;
    const tone = (v) => (v > 0 ? "good" : v < 0 ? "bad" : "");
    renderStats(ui.stats, [
      { label: "Total return", value: pct(s.totalReturn), tone: tone(s.totalReturn), help: "bt.return" },
      { label: "Buy & hold", value: pct(s.buyHold), help: "bt.bh" },
      { label: "Trades", value: fmtInt(s.trades), help: "bt.trades" },
      { label: "Win rate", value: Number.isFinite(s.winRate) ? `${(s.winRate * 100).toFixed(1)}%` : "—", help: "bt.winrate" },
      { label: "Profit factor", value: Number.isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : s.profitFactor === Infinity ? "∞" : "—", tone: s.profitFactor > 1 ? "good" : s.profitFactor < 1 ? "bad" : "", help: "bt.pf" },
      { label: "Max drawdown", value: `−${(s.maxDrawdown * 100).toFixed(1)}%`, help: "bt.mdd" },
      { label: "Average trade", value: pct(s.avgTrade, 2), tone: tone(s.avgTrade), help: "bt.avg" },
      { label: "Time in market", value: `${(s.exposure * 100).toFixed(1)}%`, help: "bt.exposure" },
      { label: "Leverage", value: `${s.leverage}× · ${Math.round(s.marginPct)}% margin`, help: "bt.leverage" },
      { label: "Liquidations", value: fmtInt(s.liquidations), tone: s.liquidations ? "bad" : "", help: "bt.liquidation" },
      { label: "Skipped signals", value: fmtInt(s.skipped.target + s.skipped.stop + s.skipped.untradable), help: "bt.skipped" },
    ]);
    const bh = Array.from(bt.close, (c) => (c / bt.open[0]) * 100);
    timeChart(ui.equity, {
      series: [
        { name: "Model", x: bt.times, y: Array.from(sim.equity, (v) => v * 100), cls: "c-accent", area: true, width: 2.2 },
        { name: "Buy & hold", x: bt.times, y: bh, cls: "c-muted", dashed: true, width: 1.6 },
      ],
      hLines: [{ y: 100, label: "start = 100" }], yFormat: (v) => v.toFixed(0),
    });
    const step = Math.max(1, Math.ceil(sim.trades.length / 400));
    timeChart(ui.price, {
      series: [{ name: bt.symbol, x: bt.times, y: bt.close, cls: "c-ink", width: 1.3 }],
      markers: sim.trades.filter((_, k) => k % step === 0).map((t) => ({ x: t.entryTime, y: t.entry, cls: t.net > 0 ? "f-good" : "f-bad", r: 3.2, title: `${fmtUtc(t.entryTime)} · ${t.outcome} · ${pct(t.net, 2)}` })),
      yFormat: (v) => fmtPrice(v),
    });
    const o = s.outcomes, total = Math.max(1, s.trades);
    barsHtml(ui.outcomes, [
      { label: "Target hit", value: o.target, text: `${o.target} · ${((o.target / total) * 100).toFixed(0)}%`, tone: "good" },
      { label: "Stopped out", value: o.stop, text: `${o.stop} · ${((o.stop / total) * 100).toFixed(0)}%`, tone: "bad" },
      { label: "Timed out", value: o.timeout, text: `${o.timeout} · ${((o.timeout / total) * 100).toFixed(0)}%`, tone: "warn" },
      ...(o.end ? [{ label: "Open at end", value: o.end, text: String(o.end) }] : []),
      ...(s.skipped.target ? [{ label: "Skipped: past target", value: s.skipped.target, text: `${s.skipped.target} signals` }] : []),
      ...(s.skipped.stop ? [{ label: "Skipped: past stop", value: s.skipped.stop, text: `${s.skipped.stop} signals` }] : []),
      ...(s.skipped.untradable ? [{ label: "Skipped: next candle not tradable", value: s.skipped.untradable, text: `${s.skipped.untradable} signals` }] : []),
      ...(s.outcomes.liquidated ? [{ label: "Liquidated", value: s.outcomes.liquidated, text: `${s.outcomes.liquidated} · ${((s.outcomes.liquidated / Math.max(1, total)) * 100).toFixed(0)}%`, tone: "bad" }] : []),
    ]);
    table(ui.sweep, ["Threshold", "Trades", "Win rate", "Return", "Max DD"], sweep.map((r) => [
      r.t.toFixed(2) + (Math.abs(r.t - opts.threshold) < 1e-9 ? " ◀" : ""), fmtInt(r.trades),
      Number.isFinite(r.winRate) ? `${(r.winRate * 100).toFixed(1)}%` : "—", pct(r.totalReturn), `−${(r.maxDrawdown * 100).toFixed(1)}%`,
    ]));
    const recent = sim.trades.slice(-50).reverse();
    ui.tradesHint.textContent = `${fmtInt(sim.trades.length)} trades · latest 50 shown`;
    table(ui.trades, ["Signal · UTC", "P", "Entry", "Exit", "Outcome", "Candles", "Net"], recent.map((t) => [
      fmtUtc(t.signalTime), t.prob.toFixed(3), fmtPrice(t.entry), fmtPrice(t.exit), t.outcome, String(t.bars), pct(t.net, 2),
    ]));
    ui.result.hidden = false;
    ui.result.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  ui.download.addEventListener("click", () => {
    if (!last) return;
    const rows = [["signal_time_utc", "entry_time_utc", "exit_time_utc", "probability", "entry", "exit", "outcome", "candles", "gross_return", "net_return"]];
    for (const t of last.sim.trades) rows.push([new Date(t.signalTime).toISOString(), new Date(t.entryTime).toISOString(), new Date(t.exitTime).toISOString(), t.prob, t.entry, t.exit, t.outcome, t.bars, t.gross, t.net]);
    downloadText(`${last.symbol}-backtest-trades.csv`, rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n", "text/csv");
  });
  ui.run.addEventListener("click", run);
  ui.cancel.addEventListener("click", () => market.cancel());
  for (const input of [ui.threshold, ui.slip, ui.start, ui.end]) input.addEventListener("input", () => { checkInSample(); renderRules(); });
  ui.fee.addEventListener("input", () => { feeTouched = true; renderRules(); });
  for (const node of [ui.leverage, ui.margin, ui.mmr]) node.addEventListener("input", renderRules);

  ctx.on("model", () => { if (source === "session") currentModel = null; refresh(); });
  ctx.on("infer-model", () => { source = "infer"; sourceSeg.set("infer"); currentModel = null; refresh(); });
  ctx.on("step", (step) => { if (step === "backtest") refresh(); });
  refresh();
}
