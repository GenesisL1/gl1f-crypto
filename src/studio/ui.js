// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Small DOM and formatting helpers for the crypto pipeline.

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function show(node, visible = true) { if (node) node.hidden = !visible; }

export function fmtInt(value) {
  return Number.isFinite(Number(value)) ? Math.round(Number(value)).toLocaleString("en-US") : "—";
}
export function fmtNum(value, digits = 4) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (n !== 0 && Math.abs(n) < 10 ** -digits) return n.toExponential(2);
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: Math.min(digits, 2) });
}
export function fmtPct(value, digits = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? `${(n * 100).toFixed(digits)}%` : "—";
}
export function fmtPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const digits = n >= 1000 ? 2 : n >= 1 ? 4 : n >= 0.01 ? 6 : 8;
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: Math.min(2, digits) });
}
export function fmtBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
export function fmtUtc(ms, time = true) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return "—";
  const iso = new Date(n).toISOString();
  return time ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : iso.slice(0, 10);
}
export function shortHex(value, head = 6, tail = 4) {
  const s = String(value || "");
  return s.length > head + tail + 3 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;
}
export function formatL1(wei) {
  try {
    const value = globalThis.ethers ? globalThis.ethers.formatEther(wei) : String(Number(wei) / 1e18);
    const n = Number(value);
    return `${Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 6 }) : value} L1`;
  } catch { return "—"; }
}

export function setKV(container, entries) {
  container.replaceChildren(...entries.filter(Boolean).flatMap(([k, v]) => [el("div", { class: "k", text: k }), el("div", { class: "v", text: v })]));
}

const STAT_HELP = {
  "Rows": "ds.rows", "Features": "ds.features.count", "Class 1": "ds.class1", "Test ROC AUC": "tr.auc", "Test log-loss": "tr.logloss",
  "Balanced accuracy": "tr.balacc", "Precision @ 0.5": "tr.precision", "Recall @ 0.5": "tr.recall", "Validation log-loss": "tr.valloss",
  "Validation log-loss (mean ± SD)": "tr.valloss", "Trees": "tr.usedtrees", "Model size": "tr.modelsize", "Probability": "in.prob",
  "Target": "in.target", "Stop": "in.stop", "Window ends": "in.window", "Score": "in.score", "Score · integer": "in.score",
};
export function renderStats(container, items) {
  container.replaceChildren(...items.filter(Boolean).map((item) => {
    const k = el("span", { class: "k", text: item.label });
    const help = item.help || STAT_HELP[item.label];
    if (help) k.dataset.help = help;
    return el("div", { class: "stat" }, el("span", { class: `v${item.tone ? ` ${item.tone}` : ""}${String(item.value).length > 8 ? " long" : ""}`, text: item.value, title: item.title || String(item.value) }), k);
  }));
}

export function setPill(node, text, tone = "") {
  if (!node) return;
  node.textContent = text;
  node.classList.remove("ok", "warn", "bad", "busy");
  if (tone) node.classList.add(tone);
}

export function showError(node, error) {
  if (!node) return;
  const message = error ? String(error?.message || error) : "";
  node.textContent = message;
  node.hidden = !message;
  node.classList.remove("warn");
}
export function showWarning(node, message) {
  if (!node) return;
  node.textContent = message || "";
  node.hidden = !message;
  node.classList.toggle("warn", !!message);
}

export function setProgress(bar, box, value) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value) * 100)));
  if (bar) bar.style.width = `${pct}%`;
  if (box) box.setAttribute("aria-valuenow", String(pct));
  return pct;
}

// Segmented control (role=radiogroup with role=radio buttons).
export function segmented(root, onChange) {
  const buttons = $$("button[data-value]", root);
  const set = (value, emit = true) => {
    let found = false;
    for (const button of buttons) {
      const on = button.dataset.value === value;
      if (on) found = true;
      button.setAttribute("aria-checked", on ? "true" : "false");
      button.tabIndex = on ? 0 : -1;
    }
    if (found && emit && onChange) onChange(value);
  };
  root.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button || button.disabled) return;
    set(button.dataset.value);
  });
  root.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    const enabled = buttons.filter((b) => !b.disabled);
    const index = enabled.findIndex((b) => b.getAttribute("aria-checked") === "true");
    const next = enabled[(index + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + enabled.length) % enabled.length];
    if (!next) return;
    event.preventDefault();
    set(next.dataset.value);
    next.focus();
  });
  const initial = buttons.find((b) => b.getAttribute("aria-checked") === "true") || buttons[0];
  buttons.forEach((b) => { b.tabIndex = b === initial ? 0 : -1; });
  return {
    get value() { return (buttons.find((b) => b.getAttribute("aria-checked") === "true") || buttons[0])?.dataset.value; },
    set: (value, emit = false) => set(value, emit),
    buttons,
  };
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export function downloadJson(filename, value) {
  downloadBlob(filename, new Blob([JSON.stringify(value, null, 2) + "\n"], { type: "application/json" }));
}
export function downloadText(filename, text, type = "text/plain") {
  downloadBlob(filename, new Blob([text], { type }));
}

export async function sha256Hex(data) {
  const bytes = data instanceof Blob ? await data.arrayBuffer() : typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function table(container, header, rows) {
  const thead = el("thead", {}, el("tr", {}, header.map((h) => el("th", { text: h }))));
  const tbody = el("tbody", {}, rows.map((row) => el("tr", {}, row.map((cell, i) => el("td", { class: i === 0 ? "name" : null, text: cell })))));
  container.replaceChildren(thead, tbody);
}

// Lightweight SVG line chart in the gl1f palette.
// Draw charts at the container's real pixel width, so axis text stays at its CSS size in wide layouts.
export function chartWidth(container, fallback = 760) {
  for (let node = container; node; node = node.parentElement) {
    const w = node.clientWidth;
    if (w > 0) return Math.max(480, Math.min(1600, Math.round(w - (node === container ? 0 : 48))));
  }
  return fallback;
}

export function lineChart(container, series, { marker = null, yLabel = "" } = {}) {
  const ns = "http://www.w3.org/2000/svg";
  const W = chartWidth(container, 720), H = 240, L = 52, R = 16, T = 18, B = 30;
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", series.map((s) => s.name).join(" and "));
  const points = series.flatMap((s) => s.values.map((y, i) => [s.x ? s.x[i] : i + 1, y])).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (!points.length) { container.replaceChildren(); return; }
  let [x0, x1] = [Math.min(...points.map((p) => p[0])), Math.max(...points.map((p) => p[0]))];
  let [y0, y1] = [Math.min(...points.map((p) => p[1])), Math.max(...points.map((p) => p[1]))];
  if (x1 === x0) x1 = x0 + 1;
  const pad = (y1 - y0) * 0.08 || Math.abs(y0) * 0.05 || 1;
  y0 -= pad; y1 += pad;
  const sx = (x) => L + (x - x0) / (x1 - x0) * (W - L - R);
  const sy = (y) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  const add = (tag, attrs, text) => {
    const node = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    if (text !== undefined) node.textContent = text;
    svg.append(node);
    return node;
  };
  for (let i = 0; i <= 4; i++) {
    const y = y0 + (y1 - y0) * i / 4, py = sy(y);
    add("line", { x1: L, x2: W - R, y1: py, y2: py, class: "grid" });
    add("text", { x: L - 8, y: py + 4, "text-anchor": "end" }, y.toFixed(Math.abs(y1 - y0) < 0.05 ? 4 : 3));
  }
  for (let i = 0; i <= 5; i++) {
    const x = x0 + (x1 - x0) * i / 5;
    add("text", { x: sx(x), y: H - 10, "text-anchor": "middle" }, String(Math.round(x)));
  }
  add("line", { x1: L, x2: L, y1: T, y2: H - B, class: "axis" });
  add("line", { x1: L, x2: W - R, y1: H - B, y2: H - B, class: "axis" });
  if (Number.isFinite(marker)) {
    add("line", { x1: sx(marker), x2: sx(marker), y1: T, y2: H - B, class: "marker" });
  }
  series.forEach((s, index) => {
    const d = s.values.map((y, i) => [s.x ? s.x[i] : i + 1, y]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
      .map(([x, y], i) => `${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join("");
    add("path", { d, fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-dasharray": s.dashed ? "6 5" : "none" });
    const lx = L + 12 + index * 120;
    add("line", { x1: lx, x2: lx + 18, y1: T + 4, y2: T + 4, stroke: s.color, "stroke-width": 2, "stroke-dasharray": s.dashed ? "6 5" : "none" });
    const text = add("text", { x: lx + 24, y: T + 8 }, s.name);
    text.setAttribute("class", "legend-text");
  });
  if (yLabel) add("text", { x: L, y: 11 }, yLabel);
  container.replaceChildren(svg);
}

// Page navigation for long lists read from the chain: Newer · 1 2 3 … 9 · Older. page is 0-based.
export function renderPager(nav, page, pages, onPage) {
  if (!nav) return;
  nav.hidden = pages <= 1;
  if (pages <= 1) { nav.replaceChildren(); return; }
  const btn = (label, target, { current = false, disabled = false, aria } = {}) => {
    const b = el("button", { type: "button", text: label, "aria-label": aria || `Page ${target + 1}` });
    if (current) b.setAttribute("aria-current", "page");
    b.disabled = disabled || current;
    b.addEventListener("click", () => onPage(target));
    return b;
  };
  const items = [btn("‹ Newer", page - 1, { disabled: page === 0, aria: "Newer models" })];
  const show = new Set([0, pages - 1, page - 1, page, page + 1].filter((p) => p >= 0 && p < pages));
  let last = -1;
  for (const p of [...show].sort((a, b) => a - b)) {
    if (p - last > 1) items.push(el("span", { class: "gap", text: "…" }));
    items.push(btn(String(p + 1), p, { current: p === page }));
    last = p;
  }
  items.push(btn("Older ›", page + 1, { disabled: page >= pages - 1, aria: "Older models" }));
  nav.replaceChildren(...items);
}
// A model listed for sale: BUY and its price, wherever the model appears.
export function buyBadge(listing, href) {
  if (!listing?.listed) return null;
  const badge = el(href ? "a" : "span", { class: "buy-badge", ...(href ? { href } : {}), title: "Listed for sale on the marketplace" }, el("b", { text: "BUY" }), formatL1(listing.priceWei));
  return badge;
}
