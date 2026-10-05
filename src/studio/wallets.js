// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Wallet discovery for every page. Several wallet extensions (MetaMask, Binance Wallet, Rabby, OKX…) each try to own
// window.ethereum, and the one that loads last wins, even when it is broken. With EIP-6963 every wallet announces
// itself, so the person chooses one; the choice is remembered, and "Change wallet" ([data-change-wallet]) picks again.
const KEY = "gl1f-wallet", found = new Map(), listeners = new Set();
const browser = typeof window !== "undefined" && typeof document !== "undefined";
let chosen = null;
function legacyName(p) {
  if (p.isBraveWallet) return "Brave Wallet";
  if (p.isRabby) return "Rabby";
  if (p.isOkxWallet || p.isOKExWallet) return "OKX Wallet";
  if (p.isCoinbaseWallet) return "Coinbase Wallet";
  if (p.isBinance || p.isBinanceChain || p.isBinanceW3W) return "Binance Wallet";
  if (p.isTrust || p.isTrustWallet) return "Trust Wallet";
  if (p.isMetaMask) return "MetaMask";
  return "Browser wallet";
}
function legacy() {
  const eth = globalThis.ethereum;
  const ps = Array.isArray(eth?.providers) && eth.providers.length ? eth.providers : typeof eth?.request === "function" ? [eth] : [];
  return ps.map((p, i) => ({ id: `legacy:${legacyName(p)}:${i}`, name: legacyName(p), icon: null, provider: p }));
}
// Every wallet in this browser: those that announced themselves, then older ones not already listed.
export function wallets() {
  const list = [...found.values()];
  for (const w of legacy()) if (!list.some((x) => x.provider === w.provider || x.name === w.name)) list.push(w);
  return list;
}
export const hasWallets = () => wallets().length > 0;
const saved = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
// The wallet to use without asking: the chosen one, the remembered one, or the only one.
export function currentWallet() {
  if (chosen) return chosen;
  const list = wallets(), s = saved();
  return (s && list.find((w) => w.id === s)) || (list.length === 1 ? list[0] : null);
}
export const currentProvider = () => currentWallet()?.provider || null;
function updateLinks() {
  if (!browser) return;
  const n = wallets().length;
  document.querySelectorAll("[data-change-wallet]").forEach((el) => { el.hidden = n < 2; });
}
function chooser(list) {
  return new Promise((resolve, reject) => {
    const modal = document.createElement("div"), card = document.createElement("div");
    modal.className = "modal wallet-modal"; modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true"); modal.setAttribute("aria-label", "Choose a wallet");
    card.className = "wallet-card";
    card.innerHTML = '<h3>Choose a wallet</h3><p class="small muted">Several wallets are installed in this browser. Pick the one to use here; you can change it later.</p><div class="wallet-list"></div><div class="row"><button type="button" class="btn small" data-cancel>Cancel</button></div>';
    const box = card.querySelector(".wallet-list");
    const close = () => { modal.remove(); document.removeEventListener("keydown", esc); };
    const cancel = () => { close(); reject(Object.assign(new Error("No wallet chosen"), { code: 4001 })); };
    const esc = (e) => { if (e.key === "Escape") cancel(); };
    for (const w of list) {
      const b = document.createElement("button"), span = document.createElement("span");
      b.type = "button"; b.className = "wallet-option";
      if (w.icon) { const img = document.createElement("img"); img.src = w.icon; img.alt = ""; b.append(img); }
      span.textContent = w.name; b.append(span);
      b.addEventListener("click", () => { close(); resolve(w); });
      box.append(b);
    }
    card.querySelector("[data-cancel]").addEventListener("click", cancel);
    modal.addEventListener("click", (e) => { if (e.target === modal) cancel(); });
    document.addEventListener("keydown", esc);
    modal.append(card); document.body.append(modal);
    box.querySelector("button")?.focus();
  });
}
// The wallet to use, asking when several are installed and none was chosen yet (force: always ask).
export async function pickWallet({ force = false } = {}) {
  if (!force) { const w = currentWallet(); if (w) return (chosen = w); }
  if (browser && !found.size) { window.dispatchEvent(new Event("eip6963:requestProvider")); await new Promise((r) => setTimeout(r, 300)); }
  const list = wallets();
  if (!list.length) throw new Error(browser && location.protocol === "file:" ? "No wallet found. Wallet extensions usually do not run on pages opened from disk: open the site from its web address." : "No wallet found in this browser. Install a wallet such as MetaMask and reload the page.");
  const w = list.length === 1 && !force ? list[0] : await chooser(list);
  chosen = w;
  try { localStorage.setItem(KEY, w.id); } catch { /* private mode */ }
  listeners.forEach((f) => { try { f(w); } catch { /* listener */ } });
  updateLinks();
  return w;
}
export function onWalletSelected(f) { listeners.add(f); return () => listeners.delete(f); }
export function forgetWallet() { chosen = null; try { localStorage.removeItem(KEY); } catch { /* private mode */ } }
export async function changeWallet() { forgetWallet(); return pickWallet({ force: true }); }
// A wallet request that cannot hang forever: a broken extension gets a clear message and is forgotten.
export function walletRequest(provider, args, ms) {
  const long = Number(globalThis.GL1F_WALLET_TIMEOUT_MS) || 120_000;
  const limit = ms ?? (args.method === "eth_requestAccounts" || String(args.method).startsWith("wallet_") ? long : Math.min(long, 15_000));
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => {
    forgetWallet();
    reject(Object.assign(new Error("The wallet did not answer. If several wallet extensions are installed, use Change wallet to pick another one, or turn the others off."), { code: "WALLET_TIMEOUT" }));
  }, limit); });
  return Promise.race([provider.request(args), timeout]).finally(() => clearTimeout(timer));
}
if (browser) {
  window.addEventListener("eip6963:announceProvider", (e) => {
    const d = e.detail;
    if (!d?.info?.uuid || typeof d.provider?.request !== "function") return;
    found.set(d.info.uuid, { id: d.info.rdns || d.info.uuid, name: String(d.info.name || "Wallet").slice(0, 40), icon: /^data:image\//.test(d.info.icon || "") ? d.info.icon : null, provider: d.provider });
    updateLinks();
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  document.addEventListener("click", (e) => {
    const a = e.target.closest?.("[data-change-wallet]");
    if (a) { e.preventDefault(); changeWallet().catch(() => {}); }
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", updateLinks); else updateLinks();
}
