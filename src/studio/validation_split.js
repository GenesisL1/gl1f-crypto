/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Decentralized Science Labs
 * Pure, deterministic validation planning. All indices refer to input rows.
 * Timestamps are UTC milliseconds internally. No feature values or test scores
 * are used to select a boundary. Auto episodes are a conservative heuristic.
 */

const HOUR = 3600000;
const has = (value) => value !== undefined && value !== null && value !== "";
const number = (value, fallback) => has(value) ? Number(value) : fallback;

/** Parse ISO dates or Unix seconds/milliseconds/microseconds/nanoseconds. */
export function parseTimestamp(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : NaN;
  if (value === null || value === undefined || value === "") return NaN;
  if (typeof value === "number" || typeof value === "bigint" ||
      (typeof value === "string" && /^[+-]?\d+(?:\.\d+)?$/.test(value.trim()))) {
    let n = Number(value);
    if (!Number.isFinite(n)) return NaN;
    const magnitude = Math.abs(n);
    if (magnitude < 1e11) n *= 1000;
    else if (magnitude >= 1e17) n /= 1e6;
    else if (magnitude >= 1e14) n /= 1000;
    return Math.abs(n) <= 8.64e15 ? n : NaN;
  }
  if (typeof value !== "string") return NaN;
  const text = value.trim();
  // Interpret timezone-free ISO date-times as UTC, never the browser timezone.
  if (!/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(text)) return NaN;
  const calendar = text.slice(0, 10);
  const day = Date.parse(calendar + "T00:00:00Z");
  if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== calendar) return NaN;
  const utc = text.length === 10 ? text + "T00:00:00Z" :
    (/(?:Z|[+-]\d{2}:?\d{2})$/.test(text) ? text : text.replace(" ", "T") + "Z");
  return Date.parse(utc);
}

export function normalizeValidationConfig(input = {}) {
  const duration = (name) => ({ value: number(input[name]?.value, 0), unit: input[name]?.unit ?? "hours" });
  return {
    strategy: input.strategy ?? "random",
    timeColumn: input.timeColumn ?? "",
    seriesColumn: input.seriesColumn ?? "",
    eventColumn: input.eventColumn ?? "auto",
    splitColumn: input.splitColumn ?? "",
    boundaryMode: input.boundaryMode ?? "time",
    testFraction: number(input.testFraction, 0.2),
    valFraction: number(input.valFraction, 0.15),
    trainFraction: has(input.trainFraction) ? Number(input.trainFraction) : undefined,
    testStart: input.testStart ?? "", valStart: input.valStart ?? "",
    window: input.window ?? "expanding", folds: number(input.folds, 5),
    initialTrainFraction: number(input.initialTrainFraction, 0.4),
    rollingTrainFraction: number(input.rollingTrainFraction, 0.4),
    lookahead: duration("lookahead"), purge: duration("purge"), embargo: duration("embargo"),
    keepBlocks: input.keepBlocks ?? true, minEvents: number(input.minEvents, 30),
    panelPolicy: input.panelPolicy ?? "global", seed: number(input.seed, 42),
    stratify: input.stratify ?? false,
  };
}

function shuffled(rows, seed) {
  const out = rows.slice();
  let state = (seed | 0) || 123456789;
  for (let j = out.length - 1; j > 0; j--) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    const k = (state >>> 0) % (j + 1);
    const swap = out[j]; out[j] = out[k]; out[k] = swap;
  }
  return out;
}

/**
 * Build a complete split plan. Invalid input is returned in audit.errors;
 * callers MUST reject it before training. An invalid plan never falls back to
 * another strategy. Global cutoffs are calendar-aligned across panel series.
 * With sourceTimeline={timestamps,series,rowIndices}, row horizons count
 * original CSV observations separately within each series, even when training
 * rows were filtered. Without it they count retained input observations.
 */
export function buildValidationPlan({ nRows, timestamps, series, eventIds, predefined, labels, sourceTimeline, task = "regression", config: input = {} } = {}) {
  task = ({ binary_classification: "binary", multiclass_classification: "multiclass", multilabel_classification: "multilabel" })[task] ?? task;
  const config = normalizeValidationConfig(input);
  const errors = [], warnings = [];
  const warn = (text) => { if (!warnings.includes(text)) warnings.push(text); };
  const error = (text) => { if (!errors.includes(text) && errors.length < 20) errors.push(text); };
  const temporal = config.strategy !== "random";
  const classification = task !== "regression";
  const multilabel = task === "multilabel";
  const hasPositiveTarget = task === "binary" || multilabel;
  const plan = {
    version: 1, strategy: config.strategy, config, folds: [], test: [], finalTrain: [],
    audit: { errors, warnings, valid: false, folds: [], test: {}, range: { start: null, end: null },
      totalRows: nRows, excludedRows: 0, exploratory: false,
      sortedBy: temporal ? "time ↑" : "seeded random",
      score: config.strategy === "walk_forward" ? "Mean ± SD across folds" : "Validation score",
      rowUnit: "retained observations",
      eventMethod: config.eventColumn === "auto" ? "Heuristic positive episodes" : config.eventColumn === "none" ? "None" : "Supplied event IDs",
      effectiveGap: { hours: 0, rows: 0 } },
  };
  const enumCheck = (key, allowed) => { if (!allowed.includes(config[key])) error(`Invalid ${key}: ${String(config[key])}.`); };
  enumCheck("strategy", ["random", "chronological", "walk_forward", "predefined"]);
  const generated = config.strategy === "chronological" || config.strategy === "walk_forward";
  const walk = config.strategy === "walk_forward";
  if (generated) enumCheck("boundaryMode", ["time", "rows", "dates"]);
  if (walk) enumCheck("window", ["expanding", "rolling"]);
  if (temporal) enumCheck("panelPolicy", ["global", "per_series"]);
  if (!["regression", "binary", "multiclass", "multilabel"].includes(task)) error("Unsupported task for validation auditing.");
  const usedFractions = [];
  if ((!temporal && config.trainFraction === undefined) || (generated && config.boundaryMode !== "dates" && !has(config.testStart))) usedFractions.push("testFraction");
  if (!temporal || (config.strategy === "chronological" && config.boundaryMode !== "dates")) usedFractions.push("valFraction");
  if (walk && config.boundaryMode !== "dates") usedFractions.push("initialTrainFraction");
  if (walk && config.window === "rolling") usedFractions.push("rollingTrainFraction");
  if (!temporal && config.trainFraction !== undefined) usedFractions.push("trainFraction");
  for (const key of usedFractions) {
    if (!(Number.isFinite(config[key]) && config[key] > 0 && config[key] < 1)) error(`${key} must be greater than 0 and less than 1.`);
  }
  if (usedFractions.includes("testFraction") && usedFractions.includes("valFraction") && config.testFraction + config.valFraction >= 1) error("Training, validation and final test must each have a positive share.");
  if (!temporal && config.trainFraction !== undefined && config.trainFraction + config.valFraction >= 1) error("Training, validation and final test must each have a positive share.");
  if (walk && (!Number.isInteger(config.folds) || config.folds < 2 || config.folds > 50)) error("Validation folds must be an integer from 2 to 50.");
  if (temporal && (!Number.isInteger(config.minEvents) || config.minEvents < 1)) error("Minimum events must be a positive integer.");
  if (!temporal && (!Number.isInteger(config.seed) || config.seed < 0 || config.seed > 2147483647)) error("Seed must be an integer from 0 to 2147483647.");
  if ((temporal && typeof config.keepBlocks !== "boolean") || (!temporal && typeof config.stratify !== "boolean")) error("Block preservation and stratification must be boolean settings.");
  for (const key of temporal ? ["lookahead", "purge", "embargo"] : []) {
    const duration = config[key];
    if (!Number.isFinite(duration.value) || duration.value < 0 || !["hours", "rows"].includes(duration.unit) ||
        (duration.unit === "rows" && !Number.isInteger(duration.value))) error(`${key} requires a nonnegative duration (whole rows or hours).`);
    if (duration.unit === "hours") plan.audit.effectiveGap.hours += duration.value;
    if (duration.unit === "rows") plan.audit.effectiveGap.rows += duration.value;
  }
  if (!Number.isInteger(nRows) || nRows < 3) error("At least three valid observations are required.");
  if (classification && (!labels || labels.length !== nRows)) error("Aligned labels are required to audit classification coverage.");
  for (const [name, values] of [["timestamps", timestamps], ["series", series], ["event IDs", eventIds], ["predefined split", predefined], ["labels", labels]]) {
    if (values && ((!Array.isArray(values) && !ArrayBuffer.isView(values)) || values.length !== nRows)) error(`The ${name} array must contain exactly one value per observation.`);
  }
  if (temporal && (!timestamps || timestamps.length !== nRows)) error("Select a valid time column before using temporal validation.");
  if (temporal && config.seriesColumn && !series) error("The selected series column is unavailable.");
  if (temporal && !["auto", "none", ""].includes(config.eventColumn) && !eventIds) error("The selected event ID column is unavailable.");
  if (config.strategy === "predefined" && (!predefined || predefined.length !== nRows)) error("Select a supplied split column containing train, val, test or purge.");
  let exactVal = NaN, exactTest = NaN;
  if (temporal && config.strategy !== "predefined" && has(config.testStart)) {
    exactTest = parseTimestamp(config.testStart);
    if (!Number.isFinite(exactTest)) error("The final-test cutoff date is invalid.");
  }
  if (temporal && config.strategy !== "predefined" && config.boundaryMode === "dates") {
    exactVal = parseTimestamp(config.valStart); exactTest = parseTimestamp(config.testStart);
    if (!Number.isFinite(exactVal) || !Number.isFinite(exactTest) || exactVal >= exactTest) error("Exact dates require a validation start earlier than the final-test start.");
  }
  if (errors.length) return plan;

  const time = new Float64Array(nRows);
  const group = new Array(nRows);
  const seriesRows = new Map();
  const ordinal = new Int32Array(nRows);
  const all = Array.from({ length: nRows }, (_, index) => index);
  for (let i = 0; i < nRows; i++) {
    time[i] = timestamps ? parseTimestamp(timestamps[i]) : NaN;
    if (temporal && !Number.isFinite(time[i])) { error(`Invalid timestamp at observation ${i + 1}; use ISO dates or Unix epochs.`); if (errors.length > 8) break; }
    group[i] = series ? String(series[i] ?? "") : "";
    if (temporal && series && !has(series[i])) error(`Missing series ID at observation ${i + 1}.`);
    if (!seriesRows.has(group[i])) seriesRows.set(group[i], []);
    seriesRows.get(group[i]).push(i);
    if (classification) {
      const row = multilabel ? labels[i] : [labels[i]];
      if (!row || !row.length || (multilabel && ((!Array.isArray(row) && !ArrayBuffer.isView(row)) || (i > 0 && row.length !== labels[0].length)))) error("Multilabel targets must have a consistent, nonempty width.");
      else for (let j = 0; j < row.length; j++) {
        if (!Number.isFinite(Number(row[j])) || ((task === "binary" || multilabel) && Number(row[j]) !== 0 && Number(row[j]) !== 1)) error("Classification targets must be numeric; binary targets must be 0 or 1.");
      }
    }
  }
  if (errors.length) return plan;
  const order = (a, b) => time[a] - time[b] || a - b;
  if (timestamps) {
    all.sort(order);
    for (const rows of seriesRows.values()) rows.sort(order);
    const validTimes = all.filter((i) => Number.isFinite(time[i]));
    if (validTimes.length) plan.audit.range = { start: time[validTimes[0]], end: time[validTimes[validTimes.length - 1]] };
  }
  for (const rows of seriesRows.values()) for (let p = 0; p < rows.length; p++) ordinal[rows[p]] = p;
  // CSV filtering may remove a candle with a missing feature or target. Row
  // horizons must still advance along the original candle timeline. Callers
  // can supply that timeline and the retained-to-source mapping without
  // making any discarded feature/target values available to training.
  let horizonRows = seriesRows, horizonTime = time, horizonOrdinal = ordinal;
  const rowDuration = ["lookahead", "purge", "embargo"].some((key) => config[key].unit === "rows" && config[key].value > 0);
  if (temporal && rowDuration && sourceTimeline) {
    const rawTimestamps = sourceTimeline.timestamps, rawSeries = sourceTimeline.series, mapping = sourceTimeline.rowIndices;
    const arrayLike = (value) => Array.isArray(value) || ArrayBuffer.isView(value);
    if (!arrayLike(rawTimestamps) || !rawTimestamps.length || !arrayLike(mapping) || mapping.length !== nRows ||
        (rawSeries && (!arrayLike(rawSeries) || rawSeries.length !== rawTimestamps.length)) || (series && !rawSeries)) {
      error("Original-row horizons require aligned source timestamps, series IDs and retained row indices.");
      return plan;
    }
    const rawTime = new Float64Array(rawTimestamps.length), rawGroups = new Array(rawTimestamps.length), rawRows = new Map();
    const rawOrdinal = new Int32Array(rawTimestamps.length), retainedOrdinal = new Int32Array(nRows);
    for (let i = 0; i < rawTimestamps.length; i++) {
      rawTime[i] = parseTimestamp(rawTimestamps[i]);
      if (!Number.isFinite(rawTime[i])) error(`Invalid original timestamp at source observation ${i + 1}; original-row horizons require a complete valid timeline.`);
      rawGroups[i] = rawSeries ? String(rawSeries[i] ?? "") : "";
      if (rawSeries && !has(rawSeries[i])) error(`Missing original series ID at source observation ${i + 1}.`);
      if (!rawRows.has(rawGroups[i])) rawRows.set(rawGroups[i], []);
      rawRows.get(rawGroups[i]).push(i);
    }
    if (errors.length) return plan;
    for (const rows of rawRows.values()) {
      rows.sort((a, b) => rawTime[a] - rawTime[b] || a - b);
      for (let p = 0; p < rows.length; p++) rawOrdinal[rows[p]] = p;
    }
    const seen = new Set();
    for (let i = 0; i < nRows; i++) {
      const source = mapping[i];
      if (!Number.isInteger(source) || source < 0 || source >= rawTimestamps.length || seen.has(source)) error("Retained source row indices must be unique valid indices into the original timeline.");
      else if (rawTime[source] !== time[i] || rawGroups[source] !== group[i]) error(`Original timeline does not match retained observation ${i + 1}.`);
      else { seen.add(source); retainedOrdinal[i] = rawOrdinal[source]; }
    }
    if (errors.length) return plan;
    horizonRows = rawRows; horizonTime = rawTime; horizonOrdinal = retainedOrdinal;
    plan.audit.rowUnit = "original source observations";
    plan.audit.sourceRows = rawTimestamps.length;
  }
  const positive = (i) => hasPositiveTarget && (multilabel ? labels[i].some((x) => Number(x) > 0) : Number(labels[i]) > 0);

  // Episode identities are scoped by series. Explicit IDs may be noncontiguous;
  // all of their rows are protected, never merely the adjacent runs.
  const episode = new Array(nRows).fill(null);
  const episodeMembers = new Map();
  const registerEpisode = (i, id) => {
    episode[i] = id;
    if (!episodeMembers.has(id)) episodeMembers.set(id, []);
    episodeMembers.get(id).push(i);
  };
  if (eventIds && !["auto", "none", ""].includes(config.eventColumn)) {
    for (let i = 0; i < nRows; i++) if (has(eventIds[i])) registerEpisode(i, JSON.stringify([group[i], String(eventIds[i])]));
    if (episodeMembers.size === 0) error("The event ID column contains no event IDs.");
  } else if (config.eventColumn === "auto" && hasPositiveTarget) {
    for (const [seriesKey, rows] of seriesRows) {
      let lastPositive = -1, serial = 0;
      for (const i of rows) {
        if (!positive(i)) continue;
        const adjacent = lastPositive >= 0 && horizonOrdinal[i] === horizonOrdinal[lastPositive] + 1;
        const overlap = lastPositive >= 0 && (config.lookahead.unit === "rows" ?
          horizonOrdinal[i] - horizonOrdinal[lastPositive] <= config.lookahead.value : time[i] - time[lastPositive] <= config.lookahead.value * HOUR);
        if (!adjacent && !overlap) serial++;
        registerEpisode(i, JSON.stringify([seriesKey, "auto", serial]));
        lastPositive = i;
      }
      // An inferred episode includes intervening observations, including
      // negative targets, when positive outcome windows overlap.
      let active = null, lastPosition = -1;
      for (let p = 0; p < rows.length; p++) {
        const i = rows[p];
        if (episode[i] === null) continue;
        if (active === episode[i]) for (let q = lastPosition + 1; q < p; q++) registerEpisode(rows[q], active);
        active = episode[i]; lastPosition = p;
      }
    }
    warn("Auto-detected positive episodes are a heuristic based on adjacent positives and outcome-window overlap; their count does not establish statistical independence.");
  }
  if (config.eventColumn === "auto" && !hasPositiveTarget) {
    plan.audit.eventMethod = "Unavailable for this target type";
    warn("Automatic positive-episode detection requires binary or multilabel targets. Supply an event ID column to preserve event blocks for this task.");
  }
  if (config.eventColumn === "none") warn("Event IDs are disabled; independent event counts cannot be verified.");
  if (temporal && config.panelPolicy === "per_series" && seriesRows.size > 1) warn("Per-series cutoffs can use different calendar periods. Correlated series may leak information across those periods; use a global cutoff for shared market conditions.");
  if (temporal && config.lookahead.value === 0) warn("Outcome lookahead is zero. Set the full future labeling horizon for forward-looking targets; timestamp ordering alone cannot prevent label overlap.");
  if (!temporal) {
    warn("Random splitting assumes independent observations and does not protect against temporal leakage.");
    if (timestamps) warn("A time column is present. Use chronological holdout or walk-forward for time-dependent observations.");
  }

  // Disjoint sets connect equal timestamps and, optionally, whole event IDs.
  // One pass can then remove every member of a block crossing a boundary.
  const parent = new Int32Array(nRows);
  for (let i = 0; i < nRows; i++) parent[i] = i;
  const find = (i) => { let p = i; while (parent[p] !== p) p = parent[p]; while (parent[i] !== i) { const next = parent[i]; parent[i] = p; i = next; } return p; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };
  if (temporal) {
    const tieUnits = config.panelPolicy === "global" ? [all] : Array.from(seriesRows.values());
    for (const rows of tieUnits) for (let p = 1; p < rows.length; p++) if (time[rows[p]] === time[rows[p - 1]]) union(rows[p], rows[p - 1]);
    if (config.keepBlocks) for (const members of episodeMembers.values()) for (let p = 1; p < members.length; p++) union(members[0], members[p]);
  }
  for (let i = 0; i < nRows; i++) parent[i] = find(i);
  const blocks = new Map();
  for (let i = 0; i < nRows; i++) {
    if (!blocks.has(parent[i])) blocks.set(parent[i], []);
    blocks.get(parent[i]).push(i);
  }
  const units = config.panelPolicy === "global" ? [all] : Array.from(seriesRows.values());
  const scope = (i) => config.panelPolicy === "global" ? "global" : group[i];
  const applyBlocks = (roles, strict, label) => {
    const remove = new Set();
    for (const [id, members] of blocks) {
      let role = null, conflict = false;
      for (const i of members) { if (role === null) role = roles[i]; else if (roles[i] !== role) { conflict = true; break; } }
      if (conflict) remove.add(id);
    }
    if (remove.size && strict) error(`${label}: supplied partitions split equal timestamps or complete event blocks.`);
    if (!strict) for (let i = 0; i < nRows; i++) if (remove.has(parent[i])) roles[i] = 0;
  };
  // Compose lookahead, purge and embargo in that order. A row duration after
  // an elapsed-time duration advances from the first source observation at or
  // after that endpoint, which also works for irregular candle intervals.
  const protectedEndpoint = new Float64Array(nRows);
  for (let i = 0; i < nRows; i++) {
    let endpoint = time[i], cursor = horizonOrdinal[i];
    const rows = horizonRows.get(group[i]);
    for (const key of temporal ? ["lookahead", "purge", "embargo"] : []) {
      const { value, unit } = config[key];
      if (value === 0 || endpoint === Infinity) continue;
      if (unit === "hours") endpoint += value * HOUR;
      else {
        if (horizonTime[rows[cursor]] < endpoint) {
          let lo = cursor, hi = rows.length;
          while (lo < hi) { const mid = (lo + hi) >>> 1; if (horizonTime[rows[mid]] < endpoint) lo = mid + 1; else hi = mid; }
          cursor = lo;
        }
        cursor += value;
        endpoint = cursor < rows.length ? horizonTime[rows[cursor]] : Infinity;
      }
    }
    protectedEndpoint[i] = endpoint;
  }
  const protectBoundary = (roles, earlier, later, strict, label) => {
    const firstTime = new Map();
    for (const i of all) if (roles[i] === later) {
      if (!firstTime.has(scope(i))) firstTime.set(scope(i), time[i]);
    }
    const blocked = new Set();
    for (const i of all) if (roles[i] === earlier) {
      const cutoffTime = firstTime.get(scope(i));
      const overlaps = has(cutoffTime) && protectedEndpoint[i] >= cutoffTime;
      if (overlaps) blocked.add(parent[i]);
    }
    if (blocked.size && strict) error(`${label}: label lookahead, boundary purge or embargo overlaps the next partition.`);
    if (!strict) for (let i = 0; i < nRows; i++) if (roles[i] === earlier && blocked.has(parent[i])) roles[i] = 0;
  };
  const checkEventOverlap = (roles, label) => {
    for (const members of episodeMembers.values()) {
      const rolesSeen = new Set();
      for (const i of members) if (roles[i] > 0) rolesSeen.add(roles[i]);
      if (rolesSeen.size > 1) { error(`${label}: the same event appears in more than one retained partition. Enable complete event blocks or correct the supplied partition.`); return; }
    }
  };
  const countRole = (roles, role) => all.filter((i) => roles[i] === role);
  const rangeRows = (rows) => {
    let start = Infinity, end = -Infinity;
    for (const i of rows) if (Number.isFinite(time[i])) { if (time[i] < start) start = time[i]; if (time[i] > end) end = time[i]; }
    return { start: start === Infinity ? null : start, end: end === -Infinity ? null : end };
  };
  let expectedClasses = [];
  if (classification && !multilabel) {
    expectedClasses = task === "binary" ? [0, 1] : Array.from(new Set(Array.from(labels, Number))).sort((a, b) => a - b);
    if (expectedClasses.length < 2) error("Classification requires at least two classes in the dataset.");
  }
  const summarize = (rows, title, check = true) => {
    const result = { count: rows.length, ...rangeRows(rows), classCounts: null, positiveEvents: null, events: null };
    if (!rows.length && check) error(`${title} is empty after leakage protection. Adjust boundaries, fold count or gaps.`);
    if (classification && check) {
      if (multilabel) {
        result.classCounts = Array.from({ length: labels[0].length }, () => ({ 0: 0, 1: 0 }));
        for (const i of rows) for (let j = 0; j < labels[i].length; j++) result.classCounts[j][Number(labels[i][j])]++;
        for (let j = 0; j < result.classCounts.length; j++) if (!result.classCounts[j][0] || !result.classCounts[j][1]) error(`${title} does not contain both classes for label ${j + 1}.`);
      } else {
        result.classCounts = Object.fromEntries(expectedClasses.map((x) => [x, 0]));
        for (const i of rows) result.classCounts[Number(labels[i])]++;
        const missing = expectedClasses.filter((x) => result.classCounts[x] === 0);
        if (missing.length) error(`${title} is missing class ${missing.join(", ")}.`);
      }
    }
    if (check) {
      const ids = new Set(), positiveIds = new Set();
      for (const i of rows) if (episode[i] !== null) { ids.add(episode[i]); if (positive(i)) positiveIds.add(episode[i]); }
      if (config.eventColumn !== "none" && (config.eventColumn !== "auto" || hasPositiveTarget)) {
        result.events = ids.size; result.positiveEvents = hasPositiveTarget ? positiveIds.size : null;
        const eventCount = hasPositiveTarget ? positiveIds.size : ids.size;
        if (title !== "Final training" && eventCount < config.minEvents) {
          warn(`${title} contains ${eventCount} ${hasPositiveTarget ? "positive " : ""}event groups, below the configured minimum of ${config.minEvents}; results are exploratory.`);
          plan.audit.exploratory = true;
        }
      }
    }
    return result;
  };
  const addFold = (roles, label, strict = false) => {
    if (temporal) {
      applyBlocks(roles, strict, label);
      protectBoundary(roles, 1, 2, strict, `${label} training → validation`);
      protectBoundary(roles, 2, 3, strict, `${label} validation → test`);
      protectBoundary(roles, 1, 3, strict, `${label} training → test`);
      checkEventOverlap(roles, label);
    }
    const fold = { train: countRole(roles, 1), val: countRole(roles, 2), purged: countRole(roles, 0) };
    plan.folds.push(fold);
    plan.audit.folds.push({ train: summarize(fold.train, `${label} training`), val: summarize(fold.val, `${label} validation`), purged: summarize(fold.purged, `${label} purged`, false) });
    return roles;
  };

  if (config.strategy === "random") {
    // Match the legacy trainer exactly: one global shuffle, then class buckets
    // in that shuffled order; per-partition floors, and the same empty-split
    // fallback. The audit must describe the model the existing trainer fits.
    const indices = shuffled(Array.from({ length: nRows }, (_, i) => i), config.seed);
    const fracTrain = config.trainFraction ?? (1 - config.testFraction - config.valFraction);
    const fracVal = config.valFraction;
    const ordinarySplit = () => {
      let nTrain = Math.floor(nRows * fracTrain), nVal = Math.floor(nRows * fracVal);
      if (nTrain < 1) nTrain = 1;
      if (nVal < 1) nVal = 1;
      if (nTrain + nVal >= nRows) nVal = Math.max(1, nRows - nTrain - 1);
      const nTest = Math.max(1, nRows - nTrain - nVal);
      return { train: indices.slice(0, nTrain), val: indices.slice(nTrain, nTrain + nVal), test: indices.slice(nTrain + nVal, nTrain + nVal + nTest) };
    };
    let split = ordinarySplit();
    if (config.stratify && classification && !multilabel) {
      const buckets = new Map();
      for (const i of indices) {
        const key = Number(labels[i]) | 0;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(i);
      }
      const train = [], val = [], test = [];
      for (const key of Array.from(buckets.keys()).sort((a, b) => a - b)) {
        const rows = buckets.get(key), n = rows.length;
        let nTrain = Math.floor(n * fracTrain), nVal = Math.floor(n * fracVal);
        if (nTrain + nVal >= n) {
          nVal = Math.max(0, n - nTrain - 1);
          if (nTrain + nVal >= n) nTrain = Math.max(0, n - nVal - 1);
        }
        for (let p = 0; p < nTrain; p++) train.push(rows[p]);
        for (let p = nTrain; p < nTrain + nVal; p++) val.push(rows[p]);
        for (let p = nTrain + nVal; p < n; p++) test.push(rows[p]);
      }
      if (train.length && val.length && test.length) split = { train, val, test };
    }
    if (config.stratify && multilabel) warn("Random multilabel stratification is unavailable; ordinary seeded random allocation is used.");
    plan.folds.push({ train: split.train, val: split.val, purged: [] });
    plan.audit.folds.push({ train: summarize(split.train, "Holdout training"), val: summarize(split.val, "Holdout validation"), purged: summarize([], "Holdout purged", false) });
    plan.test = split.test;
    plan.finalTrain = split.train.concat(split.val);
  } else if (config.strategy === "predefined") {
    const roles = new Int8Array(nRows);
    const names = { train: 1, training: 1, val: 2, validation: 2, test: 3, purge: 0, purged: 0 };
    for (let i = 0; i < nRows; i++) {
      const value = String(predefined[i] ?? "").trim().toLowerCase();
      if (!Object.hasOwn(names, value)) error(`Unknown predefined split value at observation ${i + 1}: ${value || "(empty)"}. Use train, val, test or purge.`);
      else roles[i] = names[value];
    }
    if (errors.length) return plan;
    addFold(roles, "Predefined", true);
    plan.test = countRole(roles, 3);
    plan.finalTrain = all.filter((i) => roles[i] === 1 || roles[i] === 2);
  } else {
    // First freeze the test partition and purge development outcomes reaching
    // it. Later folds can never move a row into or out of that locked test.
    const locked = new Int8Array(nRows);
    const boundaries = [];
    for (const rows of units) {
      const start = time[rows[0]], end = time[rows[rows.length - 1]];
      let testCut, valCut;
      if (config.boundaryMode === "rows") {
        let testPos = Math.floor(rows.length * (1 - config.testFraction));
        while (testPos > 0 && testPos < rows.length && time[rows[testPos - 1]] === time[rows[testPos]]) testPos--;
        testCut = testPos < rows.length ? time[rows[testPos]] : Infinity;
        let valPos = Math.floor(rows.length * (1 - config.testFraction - config.valFraction));
        while (valPos > 0 && valPos < rows.length && time[rows[valPos - 1]] === time[rows[valPos]]) valPos--;
        valCut = valPos < rows.length ? time[rows[valPos]] : Infinity;
      } else if (config.boundaryMode === "dates") {
        testCut = exactTest; valCut = exactVal;
      } else {
        testCut = start + (end - start) * (1 - config.testFraction);
        valCut = start + (end - start) * (1 - config.testFraction - config.valFraction);
      }
      if (config.boundaryMode !== "dates" && Number.isFinite(exactTest)) {
        testCut = exactTest;
        if (config.boundaryMode === "rows") {
          let beforeTest = 0;
          while (beforeTest < rows.length && time[rows[beforeTest]] < testCut) beforeTest++;
          const valPos = Math.max(0, beforeTest - Math.floor(rows.length * config.valFraction));
          valCut = valPos < rows.length ? time[rows[valPos]] : Infinity;
        } else valCut = testCut - (end - start) * config.valFraction;
      }
      boundaries.push({ rows, start, testCut, valCut });
      for (const i of rows) locked[i] = time[i] < testCut ? 1 : 3;
    }
    applyBlocks(locked, false, "Final test");
    protectBoundary(locked, 1, 3, false, "Development → final test");
    checkEventOverlap(locked, "Final test");
    plan.test = countRole(locked, 3);
    plan.finalTrain = countRole(locked, 1);
    plan.audit.excludedRows = countRole(locked, 0).length;
    if (config.strategy === "chronological") {
      const roles = locked.slice();
      for (const { rows, valCut } of boundaries) for (const i of rows) if (roles[i] === 1 && time[i] >= valCut) roles[i] = 2;
      addFold(roles, "Holdout");
    } else {
      for (let k = 0; k < config.folds; k++) {
        const roles = locked.slice();
        for (const { rows, start, testCut, valCut } of boundaries) {
          const dev = rows.filter((i) => time[i] < testCut);
          if (!dev.length) continue;
          let lower = -Infinity, valLower, valUpper;
          if (config.boundaryMode === "rows") {
            const initial = Math.floor(dev.length * config.initialTrainFraction);
            const left = initial + Math.floor((dev.length - initial) * k / config.folds);
            const right = initial + Math.floor((dev.length - initial) * (k + 1) / config.folds);
            valLower = left < dev.length ? time[dev[left]] : testCut;
            valUpper = right < dev.length ? time[dev[right]] : testCut;
            if (config.window === "rolling") {
              let first = Math.max(0, left - Math.max(1, Math.floor(dev.length * config.rollingTrainFraction)));
              // If the lower edge lands inside a timestamp block, omit that
              // whole block instead of exceeding the requested row window.
              while (first > 0 && first < dev.length && time[dev[first]] === time[dev[first - 1]]) first++;
              lower = first < dev.length ? time[dev[first]] : testCut;
            }
          } else {
            const firstValidation = config.boundaryMode === "dates" ? valCut : start + (testCut - start) * config.initialTrainFraction;
            valLower = firstValidation + (testCut - firstValidation) * k / config.folds;
            valUpper = firstValidation + (testCut - firstValidation) * (k + 1) / config.folds;
            if (config.window === "rolling") lower = valLower - (testCut - start) * config.rollingTrainFraction;
          }
          for (const i of rows) if (locked[i] === 1) {
            roles[i] = time[i] < valLower && time[i] >= lower ? 1 : time[i] >= valLower && time[i] < valUpper ? 2 : -1;
          }
        }
        addFold(roles, `Fold ${k + 1}`);
      }
      if (config.window === "rolling") {
        // A selected rolling experiment is also refitted on the latest
        // bounded window. Refitting on all development rows would silently
        // change its learning problem to an expanding-window experiment.
        const finalRoles = locked.slice();
        for (const { rows, start, testCut } of boundaries) {
          let lower;
          if (config.boundaryMode === "rows") {
            const dev = rows.filter((i) => time[i] < testCut);
            let first = Math.max(0, dev.length - Math.max(1, Math.floor(dev.length * config.rollingTrainFraction)));
            while (first > 0 && first < dev.length && time[dev[first]] === time[dev[first - 1]]) first++;
            lower = first < dev.length ? time[dev[first]] : testCut;
          } else lower = testCut - (testCut - start) * config.rollingTrainFraction;
          for (const i of rows) if (finalRoles[i] === 1 && time[i] < lower) finalRoles[i] = -1;
        }
        applyBlocks(finalRoles, false, "Final rolling window");
        protectBoundary(finalRoles, 1, 3, false, "Final rolling training → test");
        checkEventOverlap(finalRoles, "Final rolling window");
        plan.finalTrain = countRole(finalRoles, 1);
      }
    }
  }
  plan.audit.test = summarize(plan.test, "Locked final test");
  plan.audit.finalTrain = summarize(plan.finalTrain, "Final training");
  if (temporal && plan.test.length && !plan.finalTrain.length) error("No development observations remain before the locked test.");
  plan.audit.valid = errors.length === 0;
  return plan;
}
