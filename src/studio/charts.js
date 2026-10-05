// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Small dependency-free SVG charts. Colours come from CSS classes, so charts follow the theme.
import { chartWidth } from "./ui.js";
const NS = "http://www.w3.org/2000/svg";
let uid = 0;
function s(tag, attrs = {}, parent = null, text = null) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null && v !== false) n.setAttribute(k, String(v));
  if (text !== null) n.textContent = text;
  if (parent) parent.append(n);
  return n;
}
function ticks(min, max, count = 4) {
  if (!(max > min)) return [min];
  const raw = (max - min) / count, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw) || raw;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-12; v += step) out.push(+v.toPrecision(12));
  return out;
}
export function compact(v) {
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (a >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (a >= 1e4) return (v / 1e3).toFixed(1) + "k";
  if (a >= 100) return v.toFixed(0);
  if (a >= 1) return v.toFixed(2);
  if (a === 0) return "0";
  return v.toPrecision(3);
}
function dateTick(ms, span) {
  const d = new Date(ms);
  if (span <= 2 * 86_400_000) return d.toISOString().slice(11, 16);
  if (span <= 400 * 86_400_000) return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}
function downsample(x, y, max = 900) {
  const n = x.length;
  if (n <= max) return { x: Array.from(x), y: Array.from(y) };
  const step = n / max, ox = [], oy = [];
  for (let i = 0; i < max; i++) { const j = Math.min(n - 1, Math.floor(i * step)); ox.push(x[j]); oy.push(y[j]); }
  ox.push(x[n - 1]); oy.push(y[n - 1]);
  return { x: ox, y: oy };
}

// Time-series chart: series [{name, x, y, cls, width, dashed, area}], markers [{x, y, cls, r, title}],
// bands [{from, to, cls, label}], strip {x, v (0..1), cls} drawn under the plot.
export function timeChart(container, { series = [], markers = [], bands = [], strip = null, height = 260, yFormat = compact, hLines = [] } = {}) {
  container.replaceChildren();
  const W = chartWidth(container, 760), stripH = strip ? 18 : 0, P = { l: 58, r: 14, t: 22, b: 26 + stripH }, H = height;
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": series.map((x) => x.name).join(", ") }, container);
  const id = `g${++uid}`;
  const defs = s("defs", {}, svg), grad = s("linearGradient", { id: `${id}a`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  s("stop", { offset: 0, style: "stop-color:var(--accent);stop-opacity:.22" }, grad);
  s("stop", { offset: 1, style: "stop-color:var(--accent);stop-opacity:0" }, grad);
  const data = series.map((se) => ({ ...se, ...downsample(se.x, se.y) }));
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (const d of data) d.x.forEach((xv, i) => { const yv = d.y[i]; if (!Number.isFinite(yv)) return; xmin = Math.min(xmin, xv); xmax = Math.max(xmax, xv); ymin = Math.min(ymin, yv); ymax = Math.max(ymax, yv); });
  for (const m of markers) { ymin = Math.min(ymin, m.y); ymax = Math.max(ymax, m.y); }
  for (const h of hLines) { ymin = Math.min(ymin, h.y); ymax = Math.max(ymax, h.y); }
  if (!Number.isFinite(xmin)) { s("text", { x: W / 2, y: H / 2, "text-anchor": "middle", class: "c-text" }, svg, "No data"); return svg; }
  const pad = (ymax - ymin) * 0.06 || Math.abs(ymax) * 0.02 || 1; ymin -= pad; ymax += pad;
  const X = (v) => P.l + (xmax > xmin ? (v - xmin) / (xmax - xmin) : 0.5) * (W - P.l - P.r);
  const Y = (v) => P.t + (1 - (v - ymin) / (ymax - ymin)) * (H - P.t - P.b);
  for (const b of bands) {
    const x0 = X(Math.max(xmin, b.from)), x1 = X(Math.min(xmax, b.to));
    if (x1 > x0) { s("rect", { x: x0, y: P.t, width: x1 - x0, height: H - P.t - P.b, class: b.cls || "f-band" }, svg); if (b.label) s("text", { x: x0 + 6, y: P.t + 12, class: "c-text" }, svg, b.label); }
  }
  for (const t of ticks(ymin, ymax, 4)) {
    const y = Y(t); if (y < P.t - 1 || y > H - P.b + 1) continue;
    s("line", { x1: P.l, x2: W - P.r, y1: y, y2: y, class: "c-grid" }, svg);
    s("text", { x: P.l - 8, y: y + 4, "text-anchor": "end", class: "c-text" }, svg, yFormat(t));
  }
  const span = xmax - xmin, xt = 5;
  for (let i = 0; i <= xt; i++) {
    const v = xmin + (span * i) / xt, x = X(v);
    s("text", { x, y: H - P.b + 16, "text-anchor": i === 0 ? "start" : i === xt ? "end" : "middle", class: "c-text" }, svg, dateTick(v, span));
  }
  for (const h of hLines) {
    s("line", { x1: P.l, x2: W - P.r, y1: Y(h.y), y2: Y(h.y), class: h.cls || "c-muted", "stroke-dasharray": "4 4", "stroke-width": 1.2 }, svg);
    if (h.label) s("text", { x: W - P.r - 4, y: Y(h.y) - 5, "text-anchor": "end", class: "c-text-strong" }, svg, h.label);
  }
  data.forEach((d, k) => {
    const pts = d.x.map((xv, i) => Number.isFinite(d.y[i]) ? `${X(xv).toFixed(1)},${Y(d.y[i]).toFixed(1)}` : null).filter(Boolean);
    if (!pts.length) return;
    if (d.area) s("path", { d: `M${pts[0]} L${pts.join(" L")} L${X(d.x[d.x.length - 1]).toFixed(1)},${H - P.b} L${X(d.x[0]).toFixed(1)},${H - P.b} Z`, fill: `url(#${id}a)` }, svg);
    s("polyline", { points: pts.join(" "), class: d.cls || "c-accent", "stroke-width": d.width || 2, "stroke-linejoin": "round", "stroke-linecap": "round", "stroke-dasharray": d.dashed ? "5 5" : null, fill: "none" }, svg);
    if (d.name && series.length > 1) {
      const lx = P.l + 8 + k * 150;
      s("line", { x1: lx, x2: lx + 18, y1: 10, y2: 10, class: d.cls || "c-accent", "stroke-width": 3, "stroke-dasharray": d.dashed ? "5 4" : null }, svg);
      s("text", { x: lx + 24, y: 14, class: "c-text-strong" }, svg, d.name);
    }
  });
  for (const m of markers) {
    const c = s("circle", { cx: X(m.x), cy: Y(m.y), r: m.r || 3.5, class: m.cls || "f-accent", stroke: "var(--surface)", "stroke-width": 1 }, svg);
    if (m.title) s("title", {}, c, m.title);
  }
  if (strip && strip.x.length) {
    const y0 = H - stripH + 2, n = strip.x.length, w = Math.max(1, (W - P.l - P.r) / n);
    for (let i = 0; i < n; i++) if (strip.v[i] > 0) s("rect", { x: X(strip.x[i]), y: y0, width: w + 0.5, height: 12, class: strip.cls || "f-accent", "fill-opacity": Math.min(1, 0.12 + strip.v[i] * 0.88).toFixed(2) }, svg);
    s("text", { x: P.l - 8, y: y0 + 10, "text-anchor": "end", class: "c-text" }, svg, "yes");
  }
  return svg;
}

// Illustration of the triple-barrier question. Not real data.
export function labelDiagram(container, { direction = "up", basePeriod = 5, movePct = 1, retracePct = 0.5, horizonText = "", horizonBars = 20 } = {}) {
  container.replaceChildren();
  const W = Math.min(900, chartWidth(container, 760)), H = 250, P = { l: 70, r: 150, t: 26, b: 34 }, up = direction !== "down";
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Illustration: label is 1 when price reaches the ${up ? "upper" : "lower"} target before the stop within the horizon.` }, container);
  const m = Math.max(0.01, movePct), r = Math.max(0, retracePct), top = up ? m * 1.35 : r * 1.6 + 0.001, bot = up ? -(r * 1.6 + 0.001) : -m * 1.35;
  const Y = (v) => P.t + (1 - (v - bot) / (top - bot)) * (H - P.t - P.b);
  const xN = P.l + (W - P.l - P.r) * 0.34, xEnd = W - P.r;
  const X = (i) => P.l + (i / 30) * (xN - P.l);
  s("rect", { x: xN, y: P.t, width: xEnd - xN, height: H - P.t - P.b, class: "f-band" }, svg);
  // The window label sits on the side away from the target, so it never collides with "target first".
  s("text", { x: xN + 8, y: up ? H - P.b - 8 : P.t + 14, class: "c-text" }, svg, `window: next ${horizonBars} candles${horizonText ? ` (${horizonText})` : ""}`);
  const tgt = up ? m : -m, stp = up ? -r : r;
  s("line", { x1: P.l, x2: xEnd, y1: Y(tgt), y2: Y(tgt), class: "c-good", "stroke-width": 2 }, svg);
  s("line", { x1: P.l, x2: xEnd, y1: Y(stp), y2: Y(stp), class: "c-bad", "stroke-width": 2 }, svg);
  s("line", { x1: P.l, x2: xEnd, y1: Y(0), y2: Y(0), class: "c-muted", "stroke-dasharray": "5 5", "stroke-width": 1.4 }, svg);
  s("text", { x: xEnd + 8, y: Y(tgt) + 4, class: "c-text-strong" }, svg, `target ${up ? "+" : "−"}${m}% → 1`);
  s("text", { x: xEnd + 8, y: Y(stp) + 4, class: "c-text-strong" }, svg, `stop ${up ? "−" : "+"}${r}% → 0`);
  s("text", { x: xEnd + 8, y: Y(0) + 4, class: "c-text" }, svg, `EMA${basePeriod} baseline`);
  // past candles
  const sgn = up ? 1 : -1, noise = [0.1, -0.15, 0.05, 0.2, -0.05, 0.12, -0.2, 0.02, 0.15, -0.1, 0.05, 0.1];
  noise.forEach((v, i) => {
    const x = X(3 + i * 2.2), o = v * m * 0.5, c = (noise[(i + 1) % noise.length]) * m * 0.5, hi = Math.max(o, c) + 0.08 * m, lo = Math.min(o, c) - 0.08 * m;
    s("line", { x1: x, x2: x, y1: Y(hi), y2: Y(lo), class: "c-muted", "stroke-width": 1.2 }, svg);
    s("rect", { x: x - 4, y: Y(Math.max(o, c)), width: 8, height: Math.max(2, Math.abs(Y(o) - Y(c))), class: c >= o ? "f-good" : "f-bad", "fill-opacity": 0.55 }, svg);
  });
  s("line", { x1: xN, x2: xN, y1: P.t, y2: H - P.b, class: "c-ink", "stroke-dasharray": "3 4", "stroke-width": 1.2 }, svg);
  s("text", { x: xN, y: H - P.b + 18, "text-anchor": "middle", class: "c-text-strong" }, svg, "candle N closes");
  // future path: wiggles, never reaches the stop, crosses the target late in the window
  const path = [0, -0.35 * r / (m || 1), 0.25, -0.55 * r / (m || 1), 0.5, 0.32, 0.72, 0.58, 0.9, 1.12].map((f) => sgn * f * m);
  const fx = (i) => xN + (i / (path.length - 1)) * (xEnd - xN) * 0.82;
  s("polyline", { points: path.map((v, i) => `${fx(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" "), class: "c-accent", "stroke-width": 2.6, fill: "none", "stroke-linejoin": "round" }, svg);
  const hit = s("circle", { cx: fx(path.length - 1), cy: Y(path[path.length - 1]), r: 6, class: "f-good" }, svg);
  s("title", {}, hit, "Target reached first: label 1");
  s("text", { x: fx(path.length - 1) - 8, y: Y(path[path.length - 1]) + (up ? -12 : 20), "text-anchor": "end", class: "c-text-strong" }, svg, "target first → 1");
  return svg;
}

export function barsHtml(container, items) {
  container.replaceChildren();
  const max = Math.max(1e-9, ...items.map((i) => Math.abs(i.value)));
  for (const it of items) {
    const row = document.createElement("div"); row.className = "bar-row";
    const k = document.createElement("span"); k.textContent = it.label; if (it.help) k.dataset.help = it.help;
    const track = document.createElement("div"); track.className = "track";
    const fill = document.createElement("div"); fill.className = `fill ${it.tone || ""}`; fill.style.width = `${Math.max(0, Math.min(100, (Math.abs(it.value) / max) * 100))}%`;
    track.append(fill);
    const n = document.createElement("span"); n.className = "n"; n.textContent = it.text ?? String(it.value);
    row.append(k, track, n); container.append(row);
  }
}

export function confusionHtml(container, { tn = 0, fp = 0, fn = 0, tp = 0 } = {}) {
  container.replaceChildren();
  const grid = document.createElement("div"); grid.className = "confusion";
  const cell = (cls, text, value) => { const d = document.createElement("div"); d.className = cls; if (value !== undefined) { const b = document.createElement("b"); b.textContent = value.toLocaleString("en-US"); d.append(b); } d.append(document.createTextNode(text)); return d; };
  grid.append(cell("h", ""), cell("h", "Model: 0"), cell("h", "Model: 1"),
    cell("h", "Real 0"), cell("c ok", "right: no move", tn), cell("c no", "false alarm", fp),
    cell("h", "Real 1"), cell("c no", "missed move", fn), cell("c ok", "caught move", tp));
  container.append(grid);
}
