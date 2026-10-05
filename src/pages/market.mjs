// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Marketplace: models for sale, all models and your models, ten per page and newest first. Every card links to the
// model's own page, where it is bought, subscribed to, run, shared and, by its admin, managed.
import { initSite, initHelp } from "../studio/site.js";
import { HELP } from "../studio/help_texts.js";
import { el, formatL1, shortHex, renderPager, buyBadge } from "../studio/ui.js";
import { setLive, cryptoLive, listModels, listingsPage, listingsFor, ownedModels, walletState, connectWallet, onWalletChange, modelPage } from "../studio/chain.js";

initSite();
initHelp(HELP);
const $ = (s) => document.querySelector(s);
const SET = "crypto", ACCESS = ["Free", "Tips", "Paid"], PAGE = 10;
const note = (node, text) => { node.textContent = text; node.hidden = !text; };
const errText = (e) => e?.shortMessage || e?.reason || e?.message || String(e);
// Links from before 1.10.8 (market.html#m=12) open the model's own page.
const legacy = Number((location.hash.match(/(?:^#|&)m=(\d+)/) || [])[1]);
if (legacy > 0) location.replace(modelPage(legacy));
// market.html#all, #mine or #sale opens that tab (the home page's "View all" link uses #all).
const tabFromHash = { "#all": "#mk-tab-all", "#mine": "#mk-tab-mine", "#sale": "#mk-tab-sale" }[location.hash];
if (tabFromHash) requestAnimationFrame(() => document.querySelector(tabFromHash)?.click());
let wallet = null;

function card(m) {
  const c = el("a", { class: "model-card market-item", href: modelPage(m.tokenId) });
  const pic = m.icon ? el("img", { src: m.icon, alt: "", loading: "lazy", width: 52, height: 52 }) : el("div", { class: "ph" });
  const access = `${ACCESS[m.pricingMode] || "—"}${m.pricingMode && m.feeWei ? ` · ${formatL1(m.feeWei)} / run` : ""}`;
  c.append(el("div", { class: "head" }, pic, el("div", { class: "title" }, el("b", { text: m.title }), el("span", { text: `#${m.tokenId} · ${access}${m.profile?.symbol ? ` · ${m.profile.symbol}` : ""}` }))));
  const stats = el("div", { class: "stats" });
  // Paid models keep their internals private: no trees, depth or signal count for anyone but their admin.
  if (m.internalsPrivate ?? (Number(m.pricingMode) === 2)) stats.append(el("div", {}, el("b", { text: "Private" }), el("span", { text: "model internals" })));
  else for (const [v, k] of [[m.nTrees, "trees"], [`d${m.depth}`, "depth"], [m.nFeatures, "signals"]]) stats.append(el("div", {}, el("b", { text: String(v) }), el("span", { text: k })));
  c.append(stats, el("div", { class: "card-actions" }, buyBadge(m.listing) || el("span", { class: "small muted", text: "Not for sale" }), el("span", { class: "card-go", text: "View model →" })));
  return c;
}
// Listings are read only for the models on screen.
async function withListings(items) {
  const listings = await listingsFor(items.filter((m) => !m.listing).map((m) => m.tokenId), SET).catch(() => new Map());
  for (const m of items) m.listing ??= listings.get(Number(m.tokenId)) || null;
  return items;
}

// For sale: the marketplace's listings, a page at a time (each page remembers where the next one starts).
const sale = { cursors: [0] };
async function loadSale(page = 0) {
  const grid = $("#mk-sale-grid"), msg = $("#mk-sale-note");
  try {
    const cursor = sale.cursors[page] ?? 0, res = await listingsPage({ cursor, limit: PAGE, set: SET });
    if (res.items.length >= PAGE && res.next > cursor) sale.cursors[page + 1] = res.next; else sale.cursors.length = page + 1;
    grid.replaceChildren(...res.items.map(card));
    note(msg, res.items.length ? "" : page ? "No more listings." : "Nothing is listed right now.");
    renderPager($("#mk-sale-pager"), page, sale.cursors.length, loadSale);
  } catch (e) { grid.replaceChildren(); note(msg, `Listings could not be read from GenesisL1 (${errText(e)}).`); }
}
// All models: ten per page, newest first.
const all = { total: 0 };
async function loadAll(page = 0) {
  const grid = $("#mk-all-grid"), msg = $("#mk-all-note");
  try {
    const before = page > 0 && all.total ? Math.max(0, all.total - page * PAGE) : null;
    const res = await listModels({ before, limit: PAGE, set: SET });
    all.total = res.total;
    const shown = before === null ? 0 : page, pages = Math.max(1, Math.ceil(res.total / PAGE));
    grid.replaceChildren(...(await withListings(res.items)).map(card));
    note(msg, res.total ? `${res.total.toLocaleString("en-US")} Crypto AI model${res.total === 1 ? "" : "s"} published · page ${shown + 1} of ${pages}, newest first.` : "No Crypto AI models yet.");
    renderPager($("#mk-all-pager"), shown, pages, loadAll);
  } catch (e) { note(msg, `Models could not be read from GenesisL1 (${errText(e)}).`); }
}
// Your models: open one to manage it on its page.
let mine = [];
async function showMine(page = 0) {
  const items = mine.slice(page * PAGE, page * PAGE + PAGE);
  $("#mk-mine-grid").replaceChildren(...(await withListings(items)).map(card));
  note($("#mk-mine-note"), mine.length ? `You are the model admin of ${mine.length} Crypto AI model${mine.length === 1 ? "" : "s"}. Open one to manage it: access, fees, plans, sale, license and more.` : "This wallet owns no Crypto AI models yet.");
  renderPager($("#mk-mine-pager"), page, Math.ceil(mine.length / PAGE), showMine);
}
async function loadMine() {
  if (!wallet) { mine = []; $("#mk-mine-grid").replaceChildren(); renderPager($("#mk-mine-pager"), 0, 0, () => {}); note($("#mk-mine-note"), "Connect the wallet that owns your Crypto AI models to see them here."); return; }
  note($("#mk-mine-note"), "Reading your models…");
  try { mine = await ownedModels(wallet, { set: SET }); await showMine(0); } catch (e) { note($("#mk-mine-note"), `Your models could not be read (${errText(e)}).`); }
}
async function refreshWallet() {
  try {
    const st = await walletState();
    wallet = st.address || null;
    $("#mk-wallet").textContent = wallet ? `${shortHex(wallet, 6, 4)}${st.onGenesis ? "" : " · wrong network"}` : st.available ? "Not connected" : "No wallet";
    $("#mk-connect").hidden = !!wallet;
  } catch { wallet = null; }
  loadMine();
}
$("#mk-connect").addEventListener("click", async () => { try { await connectWallet(); } catch (e) { note($("#mk-mine-note"), errText(e)); } refreshWallet(); });
try { onWalletChange(refreshWallet); } catch { /* no wallet */ }

if (!globalThis.ethers || !cryptoLive() || !setLive(SET)) {
  const mode = $("#mk-mode");
  mode.textContent = cryptoLive() ? "GenesisL1 could not be reached from this page." : "The GL1F Crypto contracts are not live yet. Models appear here once they are.";
  mode.hidden = false;
  for (const id of ["#mk-sale-grid", "#mk-all-grid"]) $(id).replaceChildren();
} else {
  loadSale(0); loadAll(0); refreshWallet();
}
