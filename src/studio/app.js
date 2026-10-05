// MIT License — Copyright (c) 2026 Decentralized Science Labs
// GL1F Crypto Studio: dataset → train → backtest → deploy → inference, in one page.
import { $, $$, setPill, shortHex } from "./ui.js";
import { connectWallet, switchToGenesis, walletState, onWalletChange, hasWallet } from "./chain.js";
import { initSite, initHelp, initDisclaimerGate } from "./site.js";
import { termsOnChain } from "./chain.js";
import { createWorker } from "./workers.js";
import { HELP } from "./help_texts.js";
import { saveSession, loadSession, clearSession } from "./session_store.js";
import { decodeModel } from "./local_infer.js";
import { initDataset } from "./step_dataset.js";
import { initTrain } from "./step_train.js";
import { initBacktest } from "./step_backtest.js";
import { initDeploy } from "./step_deploy.js";
import { initInfer } from "./step_infer.js";

const STEPS = ["dataset", "train", "backtest", "deploy", "infer"];

// One worker serves dataset builds, backtest replays and inference replays.
class MarketClient {
  constructor() {
    this.worker = createWorker("market");
    this.seq = 0;
    this.pending = new Map();
    this.job = null;
    this.worker.addEventListener("message", (event) => this.receive(event.data));
    this.worker.addEventListener("error", (event) => {
      const error = new Error(event.message || "The market engine stopped unexpectedly");
      for (const entry of this.pending.values()) entry.reject(error);
      this.pending.clear();
      this.job = null;
    });
  }
  receive(message) {
    if (!message) return;
    if (message.type === "progress") { this.job?.onProgress?.(message); return; }
    if (message.type === "log") { this.job?.onLog?.(message); return; }
    const entry = this.pending.get(message.requestId);
    if (!entry) return;
    this.pending.delete(message.requestId);
    if (entry === this.job) this.job = null;
    if (message.type === "cancelled") {
      const error = new Error("Cancelled");
      error.name = "AbortError";
      entry.reject(error);
    } else if (message.type === "error" || message.type.endsWith("Error")) {
      entry.reject(new Error(message.message || "Market engine error"));
    } else entry.resolve(message);
  }
  request(type, payload = {}, handlers = {}) {
    const requestId = ++this.seq;
    return new Promise((resolve, reject) => {
      const entry = { resolve, reject, ...handlers };
      this.pending.set(requestId, entry);
      if (type === "build" || type === "infer" || type === "backtest") this.job = entry;
      this.worker.postMessage({ type, requestId, ...payload });
    });
  }
  cancel() { this.worker.postMessage({ type: "cancel" }); }
  get busy() { return !!this.job; }
}

const bus = new EventTarget();
const state = { dataset: null, model: null, inferModel: null, wallet: { available: false, address: null, chainId: null, onGenesis: false } };
const ctx = {
  state,
  market: new MarketClient(),
  runtime: globalThis.GL1F_RUNTIME || {},
  emit(name, detail) { bus.dispatchEvent(new CustomEvent(name, { detail })); },
  on(name, handler) { bus.addEventListener(name, (event) => handler(event.detail)); },
  goTo,
  stepStatus,
};

function goTo(step, { scroll = true } = {}) {
  if (!STEPS.includes(step)) step = "dataset";
  for (const s of STEPS) {
    const on = s === step, tab = $(`#tab-${s}`), panel = $(`#panel-${s}`);
    tab.classList.toggle("active", on);
    tab.setAttribute("aria-selected", on ? "true" : "false");
    tab.tabIndex = on ? 0 : -1;
    panel.hidden = !on;
  }
  history.replaceState(null, "", `${location.pathname}${location.search}#${step}`);
  // Centre the active tab inside the step bar without moving the page (scrollIntoView can scroll the window on iOS).
  const tab = $(`#tab-${step}`), strip = tab.parentElement;
  if (strip.scrollWidth > strip.clientWidth)
    strip.scrollLeft += tab.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - tab.offsetWidth) / 2;
  ctx.emit("step", step);
  // Every step opens at its top, measured after the step has rendered (see alignStep).
  if (scroll) requestAnimationFrame(() => alignStep(step));
}

// The step bar is sticky, so measure the (non-sticky) panel, and jump instantly: a smooth scroll started while panels
// swap is dropped by iOS Safari, which left the next step showing its bottom.
function alignStep(step) {
  const offset = ($(".topbar")?.offsetHeight || 0) + ($(".stepper")?.offsetHeight || 0) + 8;
  const top = Math.max(0, $(`#panel-${step}`).getBoundingClientRect().top + window.scrollY - offset);
  if (window.scrollY > top + 1) {
    const root = document.documentElement, behavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, top);
    requestAnimationFrame(() => { root.style.scrollBehavior = behavior; });
  }
}
function stepStatus(step, text, done = false) {
  const sub = $(`#sub-${step}`);
  if (sub && text) sub.textContent = text;
  $(`#tab-${step}`)?.classList.toggle("done", !!done);
}
function initStepper() {
  const tabs = $$("#steps .create-tab");
  tabs.forEach((tab) => tab.addEventListener("click", () => goTo(tab.dataset.step)));
  $("#steps").addEventListener("keydown", (event) => {
    const keys = { ArrowRight: 1, ArrowLeft: -1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.classList.contains("active"));
    const next = tabs[(index + keys[event.key] + tabs.length) % tabs.length];
    goTo(next.dataset.step, { scroll: false });
    next.focus();
  });
  document.addEventListener("click", (event) => {
    const go = event.target.closest("[data-goto]");
    if (go) { event.preventDefault(); goTo(go.dataset.goto); }
  });
  const initial = location.hash.slice(1);
  goTo(STEPS.includes(initial) ? initial : "dataset", { scroll: false });
}

// The header button keeps its wallet icon (phones show only the icon, with a status dot); only its label changes.
function setConnect(button, label, status) {
  const t = button.querySelector(".connect-txt");
  if (t) t.textContent = label; else button.textContent = label;
  const name = label === "Connect" ? "Connect wallet" : label;
  button.setAttribute("aria-label", name); button.title = name; button.dataset.state = status;
}
function renderWallet() {
  const w = state.wallet, pill = $("#walletPill"), button = $("#connectBtn");
  if (!w.available) { setPill(pill, "No wallet · read-only"); setConnect(button, "Connect", "off"); }
  else if (!w.address) { setPill(pill, "Not connected"); setConnect(button, "Connect", "off"); }
  else if (!w.onGenesis) { setPill(pill, `${shortHex(w.address)} · wrong network`, "warn"); setConnect(button, "Switch network", "wrong"); }
  else { setPill(pill, `${shortHex(w.address)} · GenesisL1`, "ok"); setConnect(button, "Connected", "ok"); }
  button.disabled = !!(w.address && w.onGenesis);
  ctx.emit("wallet", w);
}
async function refreshWallet() {
  if (!globalThis.ethers) { state.wallet = { available: hasWallet(), address: null, chainId: null, onGenesis: false }; renderWallet(); return; }
  try { state.wallet = await walletState(); } catch { state.wallet = { available: hasWallet(), address: null, chainId: null, onGenesis: false }; }
  renderWallet();
}
ctx.connect = async () => {
  if (!state.wallet.address) state.wallet = await connectWallet();
  if (state.wallet.address && !state.wallet.onGenesis) state.wallet = await switchToGenesis();
  renderWallet();
  return state.wallet;
};
function initWallet() {
  $("#connectBtn").addEventListener("click", async () => {
    try { await ctx.connect(); }
    catch (error) { setPill($("#walletPill"), error?.code === 4001 ? "Request rejected" : (error?.shortMessage || error?.message || "Wallet error"), "warn"); }
  });
  onWalletChange(() => refreshWallet());
  refreshWallet();
}

// ---------- session persistence ----------
const DATASET_KEYS = ["origin", "filename", "blob", "profile", "fullProfile", "stats", "header", "matrix", "sources", "name"];
const MODEL_KEYS = ["origin", "bytes", "modelId", "featureNames", "profile", "fullProfile", "meta", "params", "curve", "validation", "testStatistics",
  "usedTrees", "datasetName", "dataRows", "title", "description", "chain", "testPeriod", "trainStartMs"];
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
let restoring = false;
function initPersistence() {
  ctx.on("dataset", (ds) => { if (!restoring && ds) saveSession("dataset", pick(ds, DATASET_KEYS)); });
  ctx.on("model", (m) => { if (!restoring && m?.bytes) saveSession("model", pick(m, MODEL_KEYS)); });
  $("#restore-clear").addEventListener("click", async () => { await clearSession(); location.replace(`${location.pathname}${location.search}`); });
}
async function restore() {
  const [ds, m] = await Promise.all([loadSession("dataset"), loadSession("model")]);
  if (!ds && !m) return;
  restoring = true;
  const parts = [];
  try {
    if (ds?.matrix && ds.profile) {
      state.dataset = ds;
      ctx.emit("dataset", ds);
      stepStatus("dataset", `Restored · ${ds.profile.symbol} · ${ds.profile.candle}`, true);
      parts.push(`dataset ${ds.profile.symbol} ${ds.profile.candle}`);
    }
    if (m?.bytes) {
      m.decoded = decodeModel(m.bytes instanceof Uint8Array ? m.bytes : new Uint8Array(m.bytes));
      state.model = m;
      ctx.emit("model", m);
      stepStatus("train", `Restored · ${m.usedTrees || m.decoded.nTrees} trees`, true);
      parts.push("model");
    }
  } catch (error) {
    console.warn("Session restore skipped:", error);
  } finally {
    restoring = false;
  }
  if (parts.length) {
    const when = new Date(Math.max(ds?.savedAt || 0, m?.savedAt || 0)).toISOString().slice(0, 16).replace("T", " ");
    $("#restore-text").textContent = `Restored your last ${parts.join(" and ")} (saved ${when} UTC).`;
    $("#restore-bar").hidden = false;
  }
}

initSite();
initHelp(HELP);
initDisclaimerGate();
termsOnChain().then((t) => { if (t) initDisclaimerGate(t.version); }).catch(() => {});
initWallet();
initDataset(ctx);
initTrain(ctx);
initBacktest(ctx);
initDeploy(ctx);
initInfer(ctx);
initPersistence();
initStepper();
restore();
