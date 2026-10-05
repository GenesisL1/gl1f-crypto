// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Shared page behaviour: theme toggle, mobile nav, tabs, help popovers, disclaimer gate.

export function initTheme() {
  const root = document.documentElement;
  const meta = document.querySelector('meta[name="theme-color"]');
  const apply = (theme) => {
    root.setAttribute("data-theme", theme);
    if (meta) meta.setAttribute("content", theme === "dark" ? "#07080b" : "#ffffff");
    document.querySelectorAll("[data-theme-toggle]").forEach((b) => b.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode"));
  };
  apply(root.getAttribute("data-theme") || "light");
  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-theme-toggle]")) return;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try { localStorage.setItem("gl1f-theme", next); } catch {}
    apply(next);
    document.dispatchEvent(new CustomEvent("themechange", { detail: next }));
  });
}

export function initNav() {
  const nav = document.querySelector(".nav"), button = document.querySelector(".menu-btn");
  if (!nav || !button) return;
  button.addEventListener("click", () => {
    const open = !nav.classList.contains("open");
    nav.classList.toggle("open", open);
    button.setAttribute("aria-expanded", open ? "true" : "false");
  });
  nav.addEventListener("click", (e) => { if (e.target.closest(".nav-links a")) { nav.classList.remove("open"); button.setAttribute("aria-expanded", "false"); } });
}

export function initTabs(root = document) {
  root.querySelectorAll("[data-tabs]").forEach((group) => {
    const tabs = [...group.querySelectorAll('[role="tab"]')];
    const select = (tab) => tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute("aria-controls"));
      if (panel) panel.hidden = !on;
    });
    tabs.forEach((t) => t.addEventListener("click", () => select(t)));
    group.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
      const i = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
      select(next); next.focus();
    });
  });
}

// "?" buttons next to any element with data-help="key". Works for content added later.
export function initHelp(texts) {
  let popover = null, owner = null;
  const close = () => { popover?.remove(); popover = null; owner?.setAttribute("aria-expanded", "false"); owner = null; };
  const decorate = (root) => {
    root.querySelectorAll?.("[data-help]:not([data-help-ready])").forEach((el) => {
      const t = texts[el.dataset.help];
      if (!t) return;
      const b = document.createElement("button");
      b.type = "button"; b.className = "help"; b.textContent = "?";
      b.setAttribute("aria-label", `What is ${t.title}?`); b.setAttribute("aria-expanded", "false"); b.dataset.helpKey = el.dataset.help;
      el.append(b);
      el.dataset.helpReady = "1";
    });
  };
  decorate(document);
  new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach((n) => n.nodeType === 1 && decorate(n.parentNode || n)))).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("click", (event) => {
    const b = event.target.closest(".help");
    if (!b) { if (popover && !event.target.closest(".popover")) close(); return; }
    event.preventDefault(); event.stopPropagation();
    if (owner === b) { close(); return; }
    close();
    const t = texts[b.dataset.helpKey];
    if (!t) return;
    popover = document.createElement("div");
    popover.className = "popover"; popover.setAttribute("role", "dialog"); popover.setAttribute("aria-label", t.title);
    const h = document.createElement("h4"); h.textContent = t.title; popover.append(h);
    for (const para of [].concat(t.body)) { const p = document.createElement("p"); p.textContent = para; popover.append(p); }
    if (t.example) { const ex = document.createElement("p"); ex.className = "ex"; ex.textContent = t.example; popover.append(ex); }
    document.body.append(popover);
    const r = b.getBoundingClientRect(), pw = popover.offsetWidth, ph = popover.offsetHeight;
    let left = Math.min(window.innerWidth - pw - 12, Math.max(12, r.left + r.width / 2 - pw / 2));
    let top = r.bottom + 8;
    if (top + ph > window.innerHeight - 12) top = Math.max(12, r.top - ph - 8);
    popover.style.left = `${left}px`; popover.style.top = `${top}px`;
    owner = b; b.setAttribute("aria-expanded", "true");
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  window.addEventListener("scroll", close, { passive: true });
  window.addEventListener("resize", close);
}

// Terms of Service acceptance, per version. The version in force is the one recorded on-chain once the contracts are
// live (the registry owner publishes new versions); before that, the version bundled with the site.
export function bundledTermsVersion() { return Number(document.querySelector('meta[name="gl1f-terms-version"]')?.content || 1); }
export function termsAccepted(version) { try { return Number(localStorage.getItem("gl1f-crypto-terms") || 0) >= version; } catch { return false; } }
export function acceptTerms(version) { try { localStorage.setItem("gl1f-crypto-terms", String(version)); } catch {} }

// The studio asks for acceptance on the first visit and again for every new version of the Terms of Service.
export function initDisclaimerGate(version = bundledTermsVersion()) {
  const modal = document.getElementById("disclaimer-modal");
  if (!modal || termsAccepted(version)) return;
  const box = modal.querySelector("#ack-check"), go = modal.querySelector("#ack-go"), label = modal.querySelector("#ack-terms-version");
  if (label) label.textContent = String(version);
  box.checked = false; go.disabled = true;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  box.onchange = () => { go.disabled = !box.checked; };
  go.onclick = () => { acceptTerms(version); modal.hidden = true; document.body.style.overflow = ""; };
  setTimeout(() => box.focus(), 50);
}

// Topbar search: route a typed market to the studio with the right exchange preselected.
export function initSearch() {
  document.querySelectorAll("[data-search]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = form.querySelector("input"), text = input.value.trim();
      if (!text) { input.focus(); return; }
      const ex = /-(USD|USDT|USDC|EUR|GBP)$/i.test(text) ? "coinbase" : /^k[A-Z0-9]+$/.test(text) || /^HYPE$/i.test(text) ? "hyperliquid" : "binance";
      location.href = `./app.html?ex=${ex}&m=${encodeURIComponent(text)}`;
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.target.closest?.("input, textarea, select, [contenteditable]")) return;
    const input = document.querySelector("[data-search] input");
    if (input && input.offsetParent !== null) { event.preventDefault(); input.focus(); }
  });
}

// Share: native share sheet on phones, a small panel with links and copy on desktop.
const SHARE_TARGETS = [
  ["X", (u, t) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}&hashtags=CryptoAI,GenesisL1`],
  ["Telegram", (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`],
  ["WhatsApp", (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}`],
  ["LinkedIn", (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}`],
  ["Facebook", (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`],
  ["Reddit", (u, t) => `https://www.reddit.com/submit?url=${encodeURIComponent(u)}&title=${encodeURIComponent(t)}`],
  ["Email", (u, t) => `mailto:?subject=${encodeURIComponent(t)}&body=${encodeURIComponent(`${t}\n\n${u}`)}`],
];
let sharePanel = null;
function closeShare() { sharePanel?.remove(); sharePanel = null; }
async function copyText(text, input) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  try { input.select(); return document.execCommand("copy"); } catch { return false; }
}
function openShare(anchor, url, text) {
  closeShare();
  const panel = document.createElement("div");
  panel.className = "share-panel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Share");
  const title = document.createElement("strong"); title.textContent = "Share";
  const row = document.createElement("div"); row.className = "share-url";
  const input = document.createElement("input"); input.readOnly = true; input.value = url; input.setAttribute("aria-label", "Link");
  const copy = document.createElement("button"); copy.type = "button"; copy.className = "btn primary small"; copy.textContent = "Copy link";
  copy.addEventListener("click", async () => { copy.textContent = (await copyText(url, input)) ? "Copied ✓" : "Press Ctrl+C"; });
  row.append(input, copy);
  const grid = document.createElement("div"); grid.className = "share-grid";
  for (const [name, make] of SHARE_TARGETS) {
    const a = document.createElement("a"); a.href = make(url, text); a.textContent = name;
    if (!a.href.startsWith("mailto:")) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    grid.append(a);
  }
  panel.append(title, row, grid);
  document.body.append(panel);
  const r = anchor.getBoundingClientRect(), w = panel.offsetWidth, h = panel.offsetHeight;
  panel.style.left = `${Math.max(12, Math.min(innerWidth - w - 12, r.right - w))}px`;
  panel.style.top = `${r.bottom + 8 + h > innerHeight - 8 ? Math.max(8, r.top - h - 8) : r.bottom + 8}px`;
  sharePanel = panel;
  input.focus(); input.select();
}
export function initShare() {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest?.("[data-share]");
    if (!button) { if (sharePanel && !event.target.closest?.(".share-panel")) closeShare(); return; }
    event.preventDefault();
    const url = button.dataset.shareUrl || document.querySelector('link[rel="canonical"]')?.href || location.href;
    const text = button.dataset.shareText || document.querySelector('meta[name="twitter:title"]')?.content || document.title;
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      try { await navigator.share({ title: document.title, text, url }); return; } catch (error) { if (error?.name === "AbortError") return; }
    }
    if (sharePanel) { closeShare(); return; }
    openShare(button, url, text);
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeShare(); });
  addEventListener("resize", closeShare);
}

export function initSite() {
  initTheme();
  initNav();
  initTabs();
  initSearch();
  initShare();
}
