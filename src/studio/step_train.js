// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Step 2 · Train
import { createWorker } from "./workers.js";
import { predictQ as fiPredictQ, decodeModel as fiDecodeModel } from "./local_infer.js";
import { featureTitle } from "./feature_labels.js";
import { $, fmtInt, fmtNum, fmtPct, fmtBytes, shortHex, setKV, renderStats, setPill, setProgress, showError, showWarning, lineChart, downloadBlob, sha256Hex, el } from "./ui.js";
import { parseCSV, toBinaryMatrix } from "./csv_parse.js";
import { buildValidationPlan } from "./validation_split.js";
import { confusionHtml, barsHtml } from "./charts.js";
import { INTERVAL_MIN as TP_MIN } from "./profile.js";
import { runValidationSearch } from "./validation_training.js";
import { assertTrainingReport } from "./training_reporting.js";
import { chooseScaleQ } from "./training_quantization.js";
import { decodeModel, attachGl1xFooter } from "./local_infer.js";
import { normalizeProfile, verifyProfileFeatures, profileForFeatures, marketLabel, targetLabel, packFeatures, defaultTitle, defaultDescription } from "./profile.js";
import { heuristicCandidate, mulberry32 } from "./search.js";

const SIZE_LIMIT = 15_000_000;
const INT32_SAFE = 2_147_480_000;

function estimateBytes(trees, depth) {
  return 24 + trees * ((2 ** depth - 1) * 8 + 2 ** depth * 4);
}
function keccakHex(bytes) {
  return globalThis.ethers ? globalThis.ethers.keccak256(bytes) : null;
}

function testPeriodOf(ds, p) {
  const T = ds?.times, idx = p?.test || p?.testIndices;
  if (!T || !idx || !idx.length || !/walk|chrono/.test(String(p.strategy || ""))) return null;
  const candleMs = (TP_MIN[ds.profile?.candle] || 0) * 60_000;
  return { startMs: T[idx[0]], endMs: T[idx[idx.length - 1]] + candleMs, rows: idx.length };
}

export function initTrain(ctx) {
  const { state } = ctx;
  const ui = {
    empty: $("#tr-empty"), ready: $("#tr-ready"), file: $("#tr-file"), file2: $("#tr-file-2"),
    title: $("#tr-source-title"), sub: $("#tr-source-sub"), validation: $("#tr-validation"), plan: $("#tr-plan"),
    trees: $("#tr-trees"), depth: $("#tr-depth"), lr: $("#tr-lr"), minLeaf: $("#tr-minleaf"),
    bins: $("#tr-bins"), binning: $("#tr-binning"), patience: $("#tr-patience"), metric: $("#tr-metric"), weights: $("#tr-weights"), seed: $("#tr-seed"), refit: $("#tr-refit"),
    advancedHint: $("#tr-advanced-hint"), size: $("#tr-size"), pill: $("#tr-pill"), stop: $("#tr-stop"), train: $("#tr-train"),
    run: $("#tr-run"), stage: $("#tr-stage"), pct: $("#tr-pct"), bar: $("#tr-bar"), progress: $("#tr-progress"),
    error: $("#tr-error"), result: $("#tr-result"), modelId: $("#tr-model-id"), stats: $("#tr-stats"), curve: $("#tr-curve"), kv: $("#tr-kv"), foldsHint: $("#tr-folds-hint"),
    folds: $("#tr-folds"), window: $("#tr-window"), initial: $("#tr-initial"), testpct: $("#tr-testpct"), lrsched: $("#tr-lrsched"), earlyStop: $("#tr-earlystop"), lrWait: $("#tr-lr-wait"), lrDrop: $("#tr-lr-drop"), lrMin: $("#tr-lr-min"), lrPieces: $("#tr-lr-pieces"),
    lrExample: $("#tr-lr-example"), lrClear: $("#tr-lr-clear"), fi: $("#tr-fi"), fiNote: $("#tr-fi-note"), fiHint: $("#tr-fi-hint"), fiUnused: $("#tr-fi-unused"), fiUnusedLabel: $("#tr-fi-unused-label"), fiRetrain: $("#tr-fi-retrain"),
    searchOn: $("#tr-search-on"), rounds: $("#tr-rounds"), searchPlan: $("#tr-search-plan"), searchBox: $("#tr-search-box"), searchTable: $("#tr-search-table"),
    searchHint: $("#tr-search-hint"), searchApply: $("#tr-search-apply"), liveOn: $("#tr-live-on"), liveBox: $("#tr-live-box"), live: $("#tr-live"), liveCaption: $("#tr-live-caption"),
  };
  const wfOnly = [...document.querySelectorAll("#panel-train [data-wf]")];
  const readInt = (node, lo, hi, fallback) => Math.min(hi, Math.max(lo, Math.round(Number(node.value)) || fallback));
  let lastBest = null;
  let ds = null, plan = null, planKey = "", training = false, aborted = false, worker = null, rejectActive = null;

  // ---------------- dataset intake ----------------

  function fromBuilt(dataset) {
    const m = dataset.matrix;
    let pos = 0;
    for (let i = 0; i < m.nRows; i++) pos += m.y[i];
    return {
      origin: "built", name: dataset.filename, X: m.X, y: m.y, times: m.times, nRows: m.nRows, nFeatures: m.nFeatures,
      featureNames: [...m.featureNames], profile: normalizeProfile(dataset.profile), fullProfile: dataset.profile, positives: pos,
    };
  }

  async function fromFiles(files) {
    const csv = files.find((f) => /\.csv$/i.test(f.name) || f.type === "text/csv");
    const json = files.find((f) => /\.json$/i.test(f.name));
    if (!csv) throw new Error("Choose a dataset CSV (and optionally its profile JSON)");
    const text = await csv.text();
    const parsed = parseCSV(text);
    const headers = parsed.headers;
    if (new Set(headers).size !== headers.length) throw new Error("CSV column names must be unique");
    const timeIndex = headers.findIndex((h) => /^(open_time|time|timestamp|date|datetime)$/i.test(h));
    const labelIndex = headers.findIndex((h) => /^label$/i.test(h)) >= 0 ? headers.findIndex((h) => /^label$/i.test(h)) : headers.length - 1;
    if (timeIndex < 0) throw new Error("The CSV needs an open_time column for chronological validation");
    const featureIndices = headers.map((_, i) => i).filter((i) => i !== timeIndex && i !== labelIndex);
    const values = new Set(parsed.rows.map((r) => r[labelIndex].trim()));
    if (![...values].every((v) => v === "0" || v === "1")) throw new Error("The label column must contain only 0 and 1");
    const matrix = toBinaryMatrix(parsed, { labelIndex, featureIndices, negLabel: "0", posLabel: "1", includeRowIndices: true });
    if (matrix.droppedRows) throw new Error(`${matrix.droppedRows} rows have missing or non-numeric values`);
    const nRows = matrix.X.length, nFeatures = featureIndices.length;
    const X = new Float32Array(nRows * nFeatures), y = Float32Array.from(matrix.y), times = new Float64Array(nRows);
    for (let i = 0; i < nRows; i++) {
      X.set(matrix.X[i], i * nFeatures);
      const raw = parsed.rows[matrix.rowIndices[i]][timeIndex];
      const t = /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : Date.parse(raw.replace(" ", "T"));
      if (!Number.isFinite(t)) throw new Error(`Invalid time "${raw}" in row ${i + 1}`);
      times[i] = t < 1e11 ? t * 1000 : t;
    }
    for (let i = 1; i < nRows; i++) if (times[i] <= times[i - 1]) throw new Error("Rows must be in strictly increasing time order");
    let profile = null, fullProfile = null, warning = null;
    if (json) {
      fullProfile = JSON.parse(await json.text());
      profile = normalizeProfile(fullProfile);
      await verifyProfileFeatures(profile, matrix.featureNames);
      const expected = fullProfile?.dataset?.checksum?.value;
      if (expected && (await sha256Hex(new TextEncoder().encode(text))) !== expected) warning = "The CSV checksum differs from its profile. Inference may not reproduce these rows.";
    }
    let pos = 0;
    for (let i = 0; i < nRows; i++) pos += y[i];
    return { origin: "file", name: csv.name, X, y, times, nRows, nFeatures, featureNames: matrix.featureNames, profile, fullProfile, positives: pos, warning };
  }

  function setDataset(next) {
    ds = next;
    plan = null; planKey = "";
    ui.empty.hidden = !!ds;
    ui.ready.hidden = !ds;
    ui.result.hidden = true;
    showError(ui.error, null);
    if (!ds) return;
    ui.title.textContent = ds.profile ? marketLabel(ds.profile) : ds.name;
    ui.sub.textContent = `${fmtInt(ds.nRows)} rows · ${ds.nFeatures} features · class 1 ${fmtPct(ds.positives / ds.nRows)}${ds.profile?.label ? ` · ${targetLabel(ds.profile.label, ds.profile.candle)}` : " · no input profile"}`;
    if (ds.warning) showWarning(ui.error, ds.warning);
    updatePlan();
    updateSize();
    ctx.stepStatus("train", "Ready to train", false);
  }

  async function loadFiles(list) {
    const files = [...(list || [])];
    if (!files.length) return;
    ui.empty.querySelector(".alert")?.remove();
    try {
      setPill(ui.pill, "Reading CSV…");
      setDataset(await fromFiles(files));
      setPill(ui.pill, "Ready");
    } catch (error) {
      setPill(ui.pill, "Ready");
      if (ds) { showError(ui.error, error); return; }
      const node = document.createElement("div");
      node.className = "alert";
      node.setAttribute("role", "alert");
      node.textContent = String(error?.message || error);
      ui.empty.append(node);
    }
  }
  ui.file.addEventListener("change", () => { loadFiles(ui.file.files); ui.file.value = ""; });
  ui.file2.addEventListener("change", () => { loadFiles(ui.file2.files); ui.file2.value = ""; });

  ctx.on("dataset", (dataset) => { if (!training) setDataset(fromBuilt(dataset)); });

  // ---------------- validation plan ----------------

  function horizonRows() {
    return Number(ds?.profile?.label?.horizonBars) || 0;
  }
  function validationConfig() {
    const strategy = ui.validation.value, seed = Number(ui.seed.value) || 42;
    const gap = { value: horizonRows(), unit: "rows" }, zero = { value: 0, unit: "rows" };
    const testFraction = readInt(ui.testpct, 5, 40, 15) / 100;
    if (strategy === "random") return { strategy, testFraction, valFraction: 0.15, seed };
    const common = { strategy, timeColumn: "open_time", testFraction, lookahead: gap, purge: zero, embargo: zero, eventColumn: "auto", keepBlocks: true, minEvents: 20, seed };
    if (strategy === "chronological") return { ...common, valFraction: 0.15 };
    const first = readInt(ui.initial, 20, 80, 40) / 100;
    return { ...common, folds: readInt(ui.folds, 2, 20, 5), window: ui.window.value === "rolling" ? "rolling" : "expanding", initialTrainFraction: first, rollingTrainFraction: first };
  }
  function updatePlan() {
    for (const node of wfOnly) node.hidden = ui.validation.value !== "walk_forward";
    updateSearchPlan();
    if (!ds) return null;
    const config = validationConfig(), key = JSON.stringify(config) + ds.nRows + ds.name;
    if (key === planKey && plan) return plan;
    try {
      plan = buildValidationPlan({ nRows: ds.nRows, timestamps: Array.from(ds.times), labels: Array.from(ds.y), task: "binary_classification", config });
      planKey = key;
      const errors = plan.audit?.errors || [];
      if (errors.length) { ui.plan.textContent = errors.join(" "); ui.plan.style.color = "var(--text-danger)"; return plan; }
      ui.plan.style.color = "";
      const folds = plan.folds.length, last = plan.folds[folds - 1];
      const parts = [
        folds > 1 ? `${folds} folds · last trains on ${fmtInt(last.train.length)} rows, validates on ${fmtInt(last.val.length)}` : `train ${fmtInt(last.train.length)} · validation ${fmtInt(last.val.length)}`,
        `final test ${fmtInt(plan.test.length)} rows (locked)`,
      ];
      if (config.strategy !== "random" && horizonRows()) parts.push(`${horizonRows()}-row label gap at every boundary`);
      if (config.strategy === "random") parts.push("rows shuffled; adjacent candles share label windows");
      ui.plan.textContent = parts.join(" · ");
    } catch (error) {
      plan = null; planKey = "";
      ui.plan.textContent = error.message;
      ui.plan.style.color = "var(--text-danger)";
    }
    return plan;
  }
  ui.validation.addEventListener("change", updatePlan);
  for (const input of [ui.folds, ui.window, ui.initial, ui.testpct]) input.addEventListener("change", updatePlan);
  function foldCount() { return ui.validation.value === "walk_forward" ? readInt(ui.folds, 2, 20, 5) : 1; }
  function updateSearchPlan() {
    const on = ui.searchOn.checked, rounds = readInt(ui.rounds, 2, 200, 12), folds = foldCount();
    ui.rounds.disabled = !on || training;
    ui.searchPlan.textContent = on
      ? `${rounds} candidates × ${folds} fold${folds === 1 ? "" : "s"} = ${rounds * folds} trainings, then one final fit. The final test stays locked until the winner is chosen.`
      : "Off: trains your exact settings once per fold.";
  }
  ui.searchOn.addEventListener("change", updateSearchPlan);
  ui.rounds.addEventListener("input", updateSearchPlan);
  ui.seed.addEventListener("change", () => { if (ui.validation.value === "random") updatePlan(); });

  function updateSize() {
    const trees = Math.max(10, Number(ui.trees.value) || 0), depth = Math.max(1, Number(ui.depth.value) || 1);
    const bytes = estimateBytes(trees, depth);
    ui.size.textContent = `Up to ${fmtBytes(bytes)} on-chain · ${Math.ceil(bytes / 24_000)} storage chunk${Math.ceil(bytes / 24_000) === 1 ? "" : "s"}${bytes > SIZE_LIMIT ? " · exceeds the 15 MB limit" : ""}`;
    ui.size.style.color = bytes > SIZE_LIMIT ? "var(--text-danger)" : "";
    ui.advancedHint.textContent = `${ui.binning.value === "quantile" ? "Quantile" : "Linear"} · ${ui.bins.value} bins · ${ui.earlyStop.checked ? `stop after ${ui.patience.value}` : "no early stop"}${{ plateau: " · LR cut on plateau", piecewise: " · piecewise LR" }[ui.lrsched.value] || ""}${ui.refit.checked ? " · refit" : ""}`;
    ui.patience.disabled = ui.metric.disabled = !ui.earlyStop.checked;
    for (const node of document.querySelectorAll("[data-lr]")) node.hidden = node.dataset.lr !== ui.lrsched.value;
  }
  for (const input of [ui.trees, ui.depth, ui.bins, ui.binning, ui.patience, ui.refit, ui.lrsched, ui.earlyStop]) { input.addEventListener("input", updateSize); input.addEventListener("change", updateSize); }
  ui.lrExample.addEventListener("click", () => { ui.lrPieces.value = "1-100 0.1\n101-200 0.05\n201-300 0.01"; ui.lrsched.value = "piecewise"; updateSize(); });
  ui.lrClear.addEventListener("click", () => { ui.lrPieces.value = ""; });

  // ---------------- training ----------------

  function baseParams() {
    const int = (node, lo, hi, fallback) => Math.min(hi, Math.max(lo, Math.round(Number(node.value)) || fallback));
    return {
      task: "binary_classification",
      trees: int(ui.trees, 10, 5000, 300), depth: int(ui.depth, 1, 12, 5),
      lr: Math.min(1, Math.max(0.001, Number(ui.lr.value) || 0.05)),
      lrSchedule: lrScheduleParam(),
      minLeaf: int(ui.minLeaf, 1, 5000, 40), bins: int(ui.bins, 8, 512, 64), binning: ui.binning.value,
      seed: int(ui.seed, 0, 2147483647, 42), earlyStop: ui.earlyStop.checked, earlyStopMetric: ui.metric.value, patience: int(ui.patience, 1, 500, 30),
      splitTrain: 0.7, splitVal: 0.15, nClasses: 2,
      imbalance: { mode: ui.weights.value === "auto" ? "auto" : "none", cap: 20, normalize: true, stratify: false },
    };
  }

  // Live chart: redraw at most ~7 times a second from the worker's per-tree progress.
  function liveDrawer() {
    let current = null, best = null, scheduled = false, last = 0;
    const fmt = (v) => (Number.isFinite(v) ? v.toFixed(4) : "—");
    const draw = () => {
      scheduled = false; last = performance.now();
      if (!current) return;
      const { curve, label } = current, series = [
        { name: "Train", values: curve.train, x: curve.steps, color: "#94a3b8" },
        { name: "Validation", values: curve.val, x: curve.steps, color: "#2f5bff" },
      ];
      if (best?.val?.length) series.push({ name: "Best so far", values: best.val, x: best.steps, color: "#ff2e7e" });
      lineChart(ui.live, series);
      ui.liveCaption.textContent = `${label} · tree ${curve.steps[curve.steps.length - 1] || 0} · validation ${fmt(curve.val[curve.val.length - 1])}`;
    };
    return {
      update(curve, label) {
        current = { curve, label };
        if (scheduled) return;
        scheduled = true;
        setTimeout(() => requestAnimationFrame(draw), Math.max(0, 140 - (performance.now() - last)));
      },
      best(curve) { best = curve; },
    };
  }

  function trainRound({ X, y, nRows, nFeatures, featureNames, scaleQ, params, phase, total, done, live }) {
    const curve = { steps: [], train: [], val: [], lr: [] };
    return new Promise((resolve, reject) => {
      const w = createWorker("train");
      worker = w;
      rejectActive = (error) => { try { w.terminate(); } catch {} reject(error); };
      const finish = () => { try { w.terminate(); } catch {} if (worker === w) worker = null; rejectActive = null; };
      w.onerror = (event) => { finish(); reject(new Error(event.message || "Training worker failed")); };
      w.onmessage = (event) => {
        const m = event.data;
        if (!m?.type) return;
        if (m.type === "progress") {
          const inRound = m.total > 0 ? m.done / m.total : 0;
          const pct = setProgress(ui.bar, ui.progress, (done + inRound) / total);
          ui.pct.textContent = `${pct}%`;
          ui.stage.textContent = `${phase} · round ${m.done}/${m.total}`;
          if (curve.steps[curve.steps.length - 1] !== m.done) {
            curve.steps.push(m.done);
            curve.train.push(Number.isFinite(m.trainMetric) ? m.trainMetric : NaN);
            curve.val.push(Number.isFinite(m.valMetric) ? m.valMetric : NaN);
            if (Number.isFinite(m.lr)) curve.lr.push(m.lr);
            live?.update(curve, phase);
          }
          return;
        }
        if (m.type === "done") {
          finish();
          try { assertTrainingReport(m.meta, params, { engine: "Browser" }); } catch (error) { reject(error); return; }
          resolve({ bytes: new Uint8Array(m.modelBytes), meta: m.meta, curve, params });
          return;
        }
        if (m.type === "error") { finish(); reject(new Error(m.message || "Training failed")); }
      };
      const Xc = new Float32Array(X), yc = new Float32Array(y);
      w.postMessage({ type: "train", X: Xc.buffer, y: yc.buffer, nRows, nFeatures, featureNames, params: { ...params, scaleQ } }, [Xc.buffer, yc.buffer]);
    });
  }

  function setBusy(on) {
    training = on;
    ui.train.disabled = on;
    ui.stop.hidden = !on;
    ui.run.hidden = !on;
    ui.validation.disabled = on;
    ui.file2.disabled = on;
    for (const node of [ui.folds, ui.window, ui.initial, ui.testpct, ui.searchOn, ui.liveOn]) node.disabled = on;
    updateSearchPlan();
  }

  // Search results table, updated as candidates finish.
  function renderSearch(entries) {
    const done = entries.filter((e) => e.status === "done" && Number.isFinite(e.meta?.bestValMetric));
    const best = done.reduce((a, e) => (!a || e.meta.bestValMetric < a.meta.bestValMetric ? e : a), null);
    const head = document.createElement("thead"), body = document.createElement("tbody"), tr = document.createElement("tr");
    for (const h of ["#", "Trees", "Depth", "LR", "Min leaf", "Patience", "Validation log-loss", "Status"]) { const th = document.createElement("th"); th.textContent = h; tr.append(th); }
    head.append(tr);
    for (const e of entries) {
      const row = document.createElement("tr");
      if (e === best) row.className = "best";
      const v = e.meta?.bestValMetric, sd = e.meta?.validationSD;
      const cells = [e.round, e.params.trees, e.params.depth, e.params.lr, e.params.minLeaf, e.params.patience,
        Number.isFinite(v) ? `${v.toFixed(4)}${Number.isFinite(sd) ? ` ± ${sd.toFixed(3)}` : ""}` : "—",
        e === best ? "best" : e.status === "error" ? `error: ${String(e.error || "").slice(0, 60)}` : e.status];
      for (const c of cells) { const td = document.createElement("td"); td.textContent = String(c); row.append(td); }
      body.append(row);
    }
    ui.searchTable.replaceChildren(head, body);
    ui.searchHint.textContent = `${done.length}/${entries.length} scored${best ? ` · best #${best.round} · ${best.meta.bestValMetric.toFixed(4)}` : ""}`;
    return best;
  }
  ui.searchApply.addEventListener("click", () => {
    if (!lastBest) return;
    ui.trees.value = lastBest.trees; ui.depth.value = lastBest.depth; ui.lr.value = lastBest.lr; ui.minLeaf.value = lastBest.minLeaf; ui.patience.value = lastBest.patience;
    updateSize();
    ui.searchApply.textContent = "Settings applied";
    setTimeout(() => { ui.searchApply.textContent = "Use best settings"; }, 1800);
  });

  async function train() {
    if (!ds || training) return;
    const p = updatePlan();
    if (!p || p.audit?.errors?.length) { showError(ui.error, p ? p.audit.errors.join(" ") : "The validation plan could not be built"); return; }
    const params0 = baseParams();
    if (estimateBytes(params0.trees, params0.depth) > SIZE_LIMIT) { showError(ui.error, "This tree count and depth exceed the 15 MB on-chain limit"); return; }
    showError(ui.error, null);
    ui.result.hidden = true;
    aborted = false;
    setBusy(true);
    setPill(ui.pill, "Training…", "busy");
    setProgress(ui.bar, ui.progress, 0); ui.pct.textContent = "0%"; ui.stage.textContent = "Preparing";
    try {
      // Quantization scale: the dataset profile fixes it; otherwise use the first training window only.
      let scaleQ = ds.profile?.scaleQ || null, maxAbs = 0;
      if (!scaleQ) {
        for (const i of p.folds[0].train) for (let j = 0; j < ds.nFeatures; j++) maxAbs = Math.max(maxAbs, Math.abs(ds.X[i * ds.nFeatures + j]));
        scaleQ = chooseScaleQ("binary_classification", maxAbs, 1);
      } else {
        for (let i = 0; i < ds.X.length; i++) if (Math.abs(Math.round(ds.X[i] * scaleQ)) > INT32_SAFE) throw new Error("A feature exceeds int32 at the profile's scaleQ");
      }
      const refit = !!ui.refit.checked;
      const rounds = ui.searchOn.checked ? readInt(ui.rounds, 2, 200, 12) : 1;
      const total = rounds * p.folds.length + 1;
      const live = ui.liveOn.checked ? liveDrawer() : null;
      ui.liveBox.hidden = !live;
      if (live) ui.live.replaceChildren();
      const entries = [], rng = mulberry32((params0.seed ^ 0x9e3779b9) >>> 0);
      const base = { ...params0, scaleQ, expectedRows: ds.nRows, validation: p.config };
      ui.searchBox.hidden = rounds === 1;
      ui.searchApply.disabled = true;
      lastBest = null;
      if (rounds > 1) renderSearch(entries);
      let completed = 0;
      const output = await runValidationSearch({
        plan: p, rounds, refit, baseParams: base,
        candidate: (round, bestParams) => heuristicCandidate({ baseParams: base, bestParams, rng, fitsSize: (t, d) => estimateBytes(t, d) <= SIZE_LIMIT }),
        isAborted: () => aborted,
        onPhase: (message) => { setPill(ui.pill, message.replace(/^Candidate 1\/1 · /, ""), "busy"); },
        onEntry: (entry, added) => {
          if (added) entries.push(entry);
          if (rounds > 1) {
            const best = renderSearch(entries);
            if (best && live) live.best(best.curve);
          } else if (!added && entry.status === "error") showError(ui.error, entry.error);
        },
        trainRound: async (params, phase) => {
          const label = params.finalFit ? "Final Crypto AI model" : String(phase.label || "").replace(/^Candidate 1\/1 · /, "").replace(/fold/, "Fold");
          const result = await trainRound({ X: ds.X, y: ds.y, nRows: ds.nRows, nFeatures: ds.nFeatures, featureNames: ds.featureNames, scaleQ, params, phase: label, total, done: completed, live });
          completed++;
          return result;
        },
      });
      if (rounds > 1) { lastBest = output.best.params; ui.searchApply.disabled = false; }
      const { result, best, finalParams, finalTrain } = output;
      const bytes = result.bytes, decoded = decodeModel(bytes), modelId = keccakHex(bytes);
      lastPlan = p;
      const stats = result.meta.testStatistics || {};
      const validation = {
        strategy: p.strategy, folds: best.foldScores, scoreMean: best.summary.mean, scoreSD: best.summary.sd,
        testRows: p.test.length, finalTrainRows: finalTrain.length, refit, warnings: p.audit?.warnings || [], config: p.config,
        search: rounds > 1 ? { rounds, scored: entries.filter((e) => e.status === "done").length, bestRound: best.round } : null,
      };
      state.model = {
        origin: "trained", bytes, decoded, modelId, featureNames: ds.featureNames.slice(), profile: ds.profile, fullProfile: ds.fullProfile,
        meta: result.meta, params: finalParams, curve: best.last.curve, validation, testStatistics: stats,
        usedTrees: Number(result.meta.usedTrees) || decoded.nTrees, datasetName: ds.name, dataRows: ds.nRows,
        title: defaultTitle(ds.profile),
        description: defaultDescription(ds.profile, { features: ds.nFeatures, validation: `${rounds > 1 ? `heuristic search over ${rounds} candidates, ` : ""}${p.strategy === "walk_forward" ? `walk-forward validated (${p.folds.length} folds)` : p.strategy === "chronological" ? "chronological holdout" : "shuffled split"}`, auc: stats.rocAuc }),
        chain: null, testPeriod: testPeriodOf(ds, p), trainStartMs: ds.times?.[0],
      };
      renderResult(state.model);
      const saveStatus = $("#tr-save-status"); saveStatus.textContent = "Not saved to a file yet"; saveStatus.classList.remove("saved");
      $("#tr-export").textContent = "Save Crypto AI model (.gl1f)";
      setPill(ui.pill, "Crypto AI model ready", "ok");
      ctx.stepStatus("train", `Test AUC ${Number.isFinite(stats.rocAuc) ? stats.rocAuc.toFixed(3) : "—"} · ${state.model.usedTrees} trees`, true);
      ctx.emit("model", state.model);
    } catch (error) {
      setPill(ui.pill, aborted ? "Stopped" : "Failed", aborted ? "" : "bad");
      if (!aborted || !/stopped/i.test(error.message)) showError(ui.error, error);
    } finally {
      setBusy(false);
    }
  }

  // ---------------- learning-rate schedule (Forest-style) ----------------
  // Piecewise lines: "start-end rate" (1-indexed trees, inclusive), also "42 0.02", ":" or "=" separators, commas.
  function parsePieces(text) {
    const segs = [];
    for (let line of String(text || "").replace(/,/g, "\n").split(/\n+/)) {
      line = line.trim().replace(/[:=]/g, " ").replace(/\s+/g, " ");
      if (!line) continue;
      const m = line.match(/^(\d+)(?:\s*[-–—]\s*(\d+))?\s+([+]?(?:\d+\.?\d*|\d*\.?\d+)(?:e[+-]?\d+)?)$/i);
      if (!m) throw new Error(`Learning-rate schedule: "${line}" should look like "1-100 0.1"`);
      const start = +m[1], end = m[2] ? +m[2] : start, lr = Number(m[3]);
      if (start < 1 || end < start || !(lr > 0)) throw new Error(`Learning-rate schedule: check "${line}"`);
      segs.push({ start, end, lr });
    }
    segs.sort((a, b) => a.start - b.start || a.end - b.end);
    for (let i = 1; i < segs.length; i++) if (segs[i].start <= segs[i - 1].end) throw new Error(`Learning-rate schedule: ranges ${segs[i - 1].start}-${segs[i - 1].end} and ${segs[i].start}-${segs[i].end} overlap`);
    return segs;
  }
  function lrScheduleParam() {
    const intOf = (node, lo, hi, fallback) => Math.min(hi, Math.max(lo, Math.round(Number(node.value)) || fallback));
    try {
      if (ui.lrsched.value === "plateau") return { mode: "plateau", patience: intOf(ui.lrWait, 1, 500, 15), dropPct: Math.min(95, Math.max(5, Number(ui.lrDrop.value) || 50)), minLR: Math.max(0.00001, Number(ui.lrMin.value) || 0.0025) };
      if (ui.lrsched.value === "piecewise") {
        const segments = parsePieces(ui.lrPieces.value);
        if (!segments.length) throw new Error("Add at least one line to the piecewise learning-rate schedule, for example 1-100 0.1");
        return { mode: "piecewise", segments };
      }
      return null;
    } catch (error) {
      showError(ui.error, error);  // a schedule mistake is shown next to the Train button, not swallowed
      throw error;
    }
  }

  // ---------------- feature scores: split use in the trees, and how much the final test suffers when a signal is shuffled ----------------
  let lastPlan = null, fiToken = 0, fiNames = [], fiUsed = new Set();
  const fiDrop = new Set();
  // Keep ticks: untick weak signals, then retrain on a trimmed copy of the dataset (same rows and labels, fewer columns).
  function updateRetrain() {
    const unused = fiNames.filter((n) => !fiUsed.has(n)).length, n = fiDrop.size + (ui.fiUnused.checked ? unused : 0);
    ui.fiUnusedLabel.textContent = `Also drop the ${unused} signal${unused === 1 ? "" : "s"} the model never used`;
    ui.fiRetrain.disabled = training || !n || fiNames.length - n < 2;
    ui.fiRetrain.textContent = n ? `Retrain without ${n} signal${n === 1 ? "" : "s"}` : "Retrain without unticked signals";
  }
  ui.fi.addEventListener("change", (e) => {
    const box = e.target.closest?.("input[data-name]");
    if (!box) return;
    if (box.checked) fiDrop.delete(box.dataset.name); else fiDrop.add(box.dataset.name);
    updateRetrain();
  });
  ui.fiUnused.addEventListener("change", updateRetrain);
  ui.fiRetrain.addEventListener("click", async () => {
    const ds = state.dataset, mx = ds?.matrix;
    if (!mx || training) return;
    const drop = new Set(fiDrop);
    if (ui.fiUnused.checked) for (const n of fiNames) if (!fiUsed.has(n)) drop.add(n);
    const names = mx.featureNames, keep = names.filter((n) => !drop.has(n));
    if (!drop.size || keep.length < 2) return;
    const F = names.length, K = keep.length, idx = keep.map((n) => names.indexOf(n)), X = new Float32Array(mx.nRows * K);
    for (let r = 0; r < mx.nRows; r++) { const row = Array.isArray(mx.X[r]) ? mx.X[r] : null; for (let j = 0; j < K; j++) X[r * K + j] = row ? row[idx[j]] : mx.X[r * F + idx[j]]; }
    const trimmed = { ...ds, filename: `${String(ds.filename || "dataset").replace(/\.csv$/i, "").replace(/-\d+-signals$/, "")}-${K}-signals.csv`, matrix: { ...mx, X, featureNames: keep, nFeatures: K }, trimmedFrom: F,
      profile: await profileForFeatures(ds.profile, keep) };
    fiDrop.clear();
    state.dataset = trimmed;
    ctx.emit("dataset", trimmed);
    setTimeout(() => ui.train.click(), 60);
  });
  function aucOf(scores, labels) {
    const idx = Array.from(scores.keys()).sort((a, b) => scores[a] - scores[b]);
    let rankSum = 0, pos = 0, i = 0;
    while (i < idx.length) { let j = i; while (j + 1 < idx.length && scores[idx[j + 1]] === scores[idx[i]]) j++; const r = (i + j) / 2 + 1; for (let k = i; k <= j; k++) if (labels[idx[k]] > 0.5) { rankSum += r; pos++; } i = j + 1; }
    const neg = idx.length - pos;
    return pos && neg ? (rankSum - (pos * (pos + 1)) / 2) / (pos * neg) : NaN;
  }
  async function renderFeatureScores(model, plan) {
    const token = ++fiToken, mx = state.dataset?.matrix;
    let d = null;
    try { d = model?.decoded || (model?.bytes ? fiDecodeModel(model.bytes) : null); } catch { d = null; }
    const names = model?.featureNames || mx?.featureNames || [];
    if (!d || !names.length || !d.perTree) { ui.fiNote.textContent = "Feature scores appear after training."; ui.fi.replaceChildren(); return; }
    const counts = new Float64Array(d.nFeatures);
    for (let tree = 0; tree < d.nTrees; tree++) for (let node = 0; node < d.internal; node++) {
      const off = d.treesOff + tree * d.perTree + node * 8;
      if (d.dv.getInt32(off + 2, true) !== 2147483647) counts[d.dv.getUint16(off, true)]++;
    }
    const total = counts.reduce((a, b) => a + b, 0) || 1, used = [...counts.keys()].filter((f) => counts[f] > 0).sort((a, b) => counts[b] - counts[a]);
    const drop = new Map();
    const draw = (note) => {
      const order = drop.size ? [...used].sort((a, b) => (drop.get(b) ?? -1) - (drop.get(a) ?? -1)) : used, max = Math.max(...order.map((f) => counts[f] / total));
      fiNames = names; fiUsed = new Set(used.map((f) => names[f]));
      ui.fi.replaceChildren(el("tr", {}, el("th", { text: "Keep" }), el("th", { text: "Signal" }), el("th", { text: "Share of splits" }), el("th", { text: "Test AUC lost when shuffled" })),
        ...order.slice(0, 60).map((f) => el("tr", {}, el("td", { class: "fi-keep" }, el("input", { type: "checkbox", "data-name": names[f], "aria-label": `Keep ${names[f]}`, checked: !fiDrop.has(names[f]) })), el("td", { text: featureTitle(names[f] || `#${f}`) }),
          el("td", {}, el("span", { class: "fi-bar", style: `width:${Math.max(2, Math.round((60 * counts[f]) / total / max))}px` }), ` ${(100 * counts[f] / total).toFixed(1)}%`),
          el("td", { text: drop.has(f) ? (drop.get(f) >= 0 ? "+" : "") + drop.get(f).toFixed(4) : "…" }))));
      ui.fiNote.textContent = note;
      ui.fiHint.textContent = `${used.length} of ${names.length} signals used`;
    };
    const rows = (Array.isArray(plan?.test) ? plan.test : []).slice(-3000), nF = mx?.nFeatures || names.length;
    if (!mx?.X || rows.length < 50) { draw("Share of splits counts how often each signal decides a split in the trees. Shuffle scores need the final test rows of this session's dataset."); return; }
    const X = mx.X, y = mx.y, row = (i) => (Array.isArray(X[i]) ? Float64Array.from(X[i]) : Float64Array.from(X.subarray(i * nF, (i + 1) * nF)));
    const base = rows.map(row), labels = rows.map((i) => Number(y[i]));
    const score = (vectors) => vectors.map((v) => Number(fiPredictQ(d, v)));
    const baseAuc = aucOf(score(base), labels);
    draw("Shuffling each signal on the final test rows…");
    let seed = 2463534242;
    const rand = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
    for (const f of used.slice(0, 40)) {
      await new Promise((r) => setTimeout(r, 0));
      if (token !== fiToken) return;
      const col = base.map((v) => v[f]);
      for (let i = col.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [col[i], col[j]] = [col[j], col[i]]; }
      const shuffled = base.map((v, k) => { const c = Float64Array.from(v); c[f] = col[k]; return c; });
      drop.set(f, baseAuc - aucOf(score(shuffled), labels));
      draw(`Shuffled ${drop.size} of ${Math.min(40, used.length)} signals on ${rows.length.toLocaleString("en-US")} final test rows (test AUC ${baseAuc.toFixed(3)}).`);
    }
    updateRetrain();
    draw(`Share of splits: how often a signal decides a split. AUC lost: how much the final-test AUC (${baseAuc.toFixed(3)} on ${rows.length.toLocaleString("en-US")} rows) drops when that signal is shuffled; higher means the model relies on it more. Top ${Math.min(40, used.length)} signals by splits are shuffled.`);
  }

  function renderResult(model) {
    const s = model.testStatistics || {}, v = model.validation;
    ui.modelId.textContent = model.modelId ? shortHex(model.modelId, 10, 8) : "";
    ui.modelId.title = model.modelId || "";
    renderStats(ui.stats, [
      { label: "Test ROC AUC", value: Number.isFinite(s.rocAuc) ? s.rocAuc.toFixed(3) : "—", tone: s.rocAuc >= 0.55 ? "good" : "" },
      { label: "Test log-loss", value: fmtNum(s.logLoss ?? model.meta.bestTestMetric, 4) },
      { label: "Balanced accuracy", value: fmtPct(s.balancedAccuracy) },
      { label: "Precision @ 0.5", value: fmtPct(s.precision) },
      { label: "Recall @ 0.5", value: fmtPct(s.recall) },
      { label: v.folds.length > 1 ? "Validation log-loss (mean ± SD)" : "Validation log-loss", value: `${fmtNum(v.scoreMean, 4)}${Number.isFinite(v.scoreSD) ? ` ± ${fmtNum(v.scoreSD, 3)}` : ""}` },
      { label: "Trees", value: `${model.usedTrees} × depth ${model.decoded.depth}` },
      { label: "Model size", value: fmtBytes(model.bytes.length) },
    ]);
    const curve = model.curve || { steps: [], train: [], val: [] };
    lineChart(ui.curve, [
      { name: "Train", values: curve.train, x: curve.steps, color: "#94a3b8" },
      { name: "Validation", values: curve.val, x: curve.steps, color: "#2563eb" },
    ], { marker: model.usedTrees });
    const cm = s.confusionMatrix, cBox = $("#tr-confusion"), bBox = $("#tr-baseline");
    if (cBox && Array.isArray(cm) && cm.length === 2) confusionHtml(cBox, { tn: cm[0][0], fp: cm[0][1], fn: cm[1][0], tp: cm[1][1] });
    if (bBox) barsHtml(bBox, [
      { label: "Model accuracy", value: s.accuracy || 0, text: fmtPct(s.accuracy), tone: "good", help: "tr.baseline" },
      { label: "Always majority", value: s.majorityBaselineAccuracy || 0, text: fmtPct(s.majorityBaselineAccuracy) },
      { label: "Model AUC", value: s.rocAuc || 0, text: Number.isFinite(s.rocAuc) ? s.rocAuc.toFixed(3) : "—", tone: s.rocAuc >= 0.55 ? "good" : "warn", help: "tr.auc" },
      { label: "Coin flip AUC", value: 0.5, text: "0.500" },
    ]);
    ui.foldsHint.textContent = `${v.folds.length} fold${v.folds.length === 1 ? "" : "s"} · test ${fmtInt(v.testRows)} rows`;
    setKV(ui.kv, [
      ["Strategy", v.strategy === "walk_forward" && v.config ? `walk-forward · ${v.folds.length} ${v.config.window || "expanding"} folds · first window ${Math.round((v.config.initialTrainFraction ?? 0.4) * 100)}% · final test ${Math.round((v.config.testFraction ?? 0.15) * 100)}%` : v.strategy.replace("_", "-")],
      ...(v.search ? [["Heuristic search", `${v.search.scored}/${v.search.rounds} candidates scored · best #${v.search.bestRound} (${model.params.trees} trees planned, depth ${model.params.depth}, LR ${model.params.lr}, min leaf ${model.params.minLeaf})`]] : []),
      ...v.folds.map((f) => [`Fold ${f.fold}`, `log-loss ${fmtNum(f.score, 4)} · ${f.usedTrees} trees · ${fmtInt(f.trainRows)} / ${fmtInt(f.validationRows)} rows`]),
      ["Final model", `${fmtInt(v.finalTrainRows)} rows${v.refit ? " (refit on development data)" : ""}`],
      ["Final test", `${fmtInt(v.testRows)} rows, evaluated once`],
      ["Base rate (test)", Number.isFinite(s.alwaysNegativeAccuracy) ? fmtPct(1 - s.alwaysNegativeAccuracy) : "—"],
      ["Brier score", fmtNum(s.brier, 4)],
      ["Quantization", `scaleQ ${fmtInt(model.decoded.scaleQ)}`],
      ["Model ID", model.modelId || "—"],
      ...(v.warnings.length ? [["Notes", v.warnings.join(" ")]] : []),
      ...(s.rocAuc > 0.8 ? [["Check", "AUC above 0.80 on market data usually means an easy question (price already past the target at the signal) or a leak. The backtest will tell."]] : []),
    ]);
    if (model && lastPlan?.test) model.testIndex = Array.from(lastPlan.test);  // the final test rows, for the report at mint
    renderFeatureScores(model, lastPlan);
    ui.result.hidden = false;
    ui.result.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  async function exportPackage() {
    const m = state.model;
    if (!m) return;
    const featuresPacked = packFeatures(m.featureNames, await profileForFeatures(m.profile, m.featureNames));
    const pkg = {
      kind: "GL1F_PACKAGE", v: 1, createdAt: new Date().toISOString(), chainId: 29,
      model: { modelId: m.modelId, bytes: m.bytes.length, nFeatures: m.decoded.nFeatures, nTrees: m.decoded.nTrees, depth: m.decoded.depth, scaleQ: m.decoded.scaleQ, task: "binary_classification" },
      nft: { title: m.title, description: m.description, featuresPacked },
      inputProfile: m.fullProfile || m.profile || null,
      local: { validation: m.validation, trainParams: m.params, testStatistics: m.testStatistics },
    };
    const name = (m.title || "model").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/_+/g, "_").slice(0, 80);
    const blob = new Blob([attachGl1xFooter(m.bytes, pkg)], { type: "application/octet-stream" });
    downloadBlob(`${name}.gl1f`, blob);
    const status = $("#tr-save-status"), button = $("#tr-export");
    status.textContent = `Saved ${name}.gl1f · ${fmtBytes(blob.size)} · ${new Date().toLocaleTimeString()}`;
    status.classList.add("saved");
    button.textContent = "Saved ✓ Save again";
  }

  ui.train.addEventListener("click", train);
  updatePlan();
  ui.stop.addEventListener("click", () => { aborted = true; setPill(ui.pill, "Stopping…"); rejectActive?.(new Error("Training stopped")); });
  $("#tr-to-deploy").addEventListener("click", () => ctx.goTo("deploy"));
  $("#tr-to-infer").addEventListener("click", () => { ctx.emit("infer-source", "session"); ctx.goTo("infer"); });
  $("#tr-to-published").addEventListener("click", () => { ctx.emit("infer-source", "published"); ctx.goTo("infer"); });
  $("#tr-export").addEventListener("click", exportPackage);
  updateSize();
}
