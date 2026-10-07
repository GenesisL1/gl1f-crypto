// MIT License — Copyright (c) 2026 Decentralized Science Labs
// A Crypto AI model's page: live sale (BUY and price), access and plans, a run on the latest candle, sharing, and the
// model admin's tools for its owner. Also adds BUY badges to listed models on the model index pages.
import { decide, yesRange, isDefaultRange } from "../studio/threshold.js";
import { initSite, initHelp, termsAccepted, acceptTerms, bundledTermsVersion } from "../studio/site.js";
import { licenseUpgradeOptions } from "../studio/licenses.js";
import { HELP } from "../studio/help_texts.js";
import { el, formatL1, shortHex, showError, buyBadge } from "../studio/ui.js";
import {
  setLive, cryptoLive, modelDetails, listingsFor, saveModelSettings, saveAccessPlan, buyAccessPlan, listForSale, cancelListing, buyListing, listingFee,
  blockTimeSec, walletState, connectWallet, onWalletChange, accessUntil, modelPage, changeModelLicense, licenseCatalog, termsOnChain,
  setInternalsVisibility, deletionStatus, deleteModel, apiClient, walletSigner,
} from "../studio/chain.js";
import { questionText } from "../studio/profile.js";
import { GL1FCrypto } from "../sdk/gl1f-crypto.js";

initSite();
initHelp(HELP);
const $ = (s) => document.querySelector(s);
const SET = "crypto", ACCESS = ["Free", "Tips", "Paid"], LIVE = cryptoLive();
const eth = () => globalThis.ethers;
const article = document.querySelector("[data-model-page]");
const ROOT = article?.dataset.root || document.querySelector("[data-root]")?.dataset.root || "./";
let wallet = null, blockSec = null, details = null, engine = null;
const days = (blocks) => (blockSec ? `${((blocks * blockSec) / 86_400).toFixed(blocks * blockSec < 86_400 * 3 ? 1 : 0)} days` : `${blocks.toLocaleString("en-US")} blocks`);
const note = (node, text) => { node.textContent = text; node.hidden = !text; };
const errText = (e) => e?.shortMessage || e?.reason || e?.message || String(e);
function licenseNode(l) {
  if (!l) return "Not recorded";
  const fine = [l.spdx && l.spdx !== l.name ? l.spdx : "", l.sinceBlock ? `since block ${Number(l.sinceBlock).toLocaleString("en-US")}` : "", "can only be opened up"].filter(Boolean).join(" · ");
  return el("span", { class: "mp-lic" }, l.url ? el("a", { href: l.url, target: "_blank", rel: "noopener noreferrer", text: l.name }) : l.name, el("small", { text: fine }));
}
// One row of a details list (the same look in every card).
const dlRow = (k, v, cls) => el("div", { class: "mp-row" }, el("dt", { text: k }), v instanceof Node ? el("dd", { class: cls || null }, v) : el("dd", { class: cls || null, text: String(v) }));
// Clickwrap: every transaction from this page requires the Terms of Service in force (the on-chain version once live).
async function ensureTerms() {
  const t = await termsOnChain().catch(() => null), version = t?.version || bundledTermsVersion();
  if (termsAccepted(version)) return true;
  const ok = confirm(`GL1F Crypto Terms of Service, version ${version}.\n\nBy continuing you accept them, including respecting the license of every Crypto AI model.\n\nRead them at ${new URL(`${ROOT}legal/terms.html`, location.href).href}`);
  if (ok) acceptTerms(version);
  return ok;
}
// ---------------- my models: the model admin panel ----------------
function adminPanel(m) {
  const box = el("details", { class: "detailsCard admin-card" });
  box.append(el("summary", {}, el("span", { text: `${m.title} · #${m.tokenId}` }), el("span", { class: "sumHint", text: `${ACCESS[m.pricingMode]}${m.listing?.listed ? " · for sale" : ""}` })));
  const body = el("div", { class: "admin-body" }), status = el("p", { class: "small muted" });
  box.append(body, status);
  box.addEventListener("toggle", async () => {
    if (!box.open || body.childElementCount) return;
    status.textContent = "Reading settings…";
    try {
      const d = await modelDetails(m.tokenId, SET);
      const say = (t) => { status.textContent = t; };
      const act = async (label, fn) => { if (!(await ensureTerms())) return; say(`${label}: confirm in your wallet…`); try { await fn(); say(`${label}: saved on-chain.`); setTimeout(refreshLive, 1200); } catch (e) { say(`${label} failed: ${errText(e)}`); } };
      // Internals: the admin chooses whether front-ends show trees, depth and signals (the bytes stay public on-chain).
      const visSel = el("select", { "aria-label": "Internals" }, ...[["0", "Default: private when paid"], ["1", "Public"], ["2", "Private"]].map(([v, t]) => el("option", { value: v, text: t })));
      visSel.value = String(m.internalsVisibility ?? 0);
      const visSave = el("button", { class: "btn2", type: "button", text: "Save" });
      visSave.addEventListener("click", () => act("Internals", () => setInternalsVisibility(m.tokenId, Number(visSel.value))));
      body.append(el("h4", { class: "sub-h", text: "Internals" }), el("p", { class: "small muted", text: "Private hides the number of trees, the depth and the signal list from everyone but you. The bytes stay public on-chain: this makes copying harder, it is not encryption." }), el("div", { class: "row wrap" }, visSel, visSave));
      // Delete: only once nobody is owed access (every paid subscription has ended); the registry enforces it too.
      const delNote = el("p", { class: "small muted", text: "Checking subscriptions…" }), delRow = el("div", { class: "row wrap" });
      body.append(el("h4", { class: "sub-h danger", text: "Delete model" }), delNote, delRow);
      deletionStatus(m.modelId).then(async (st) => {
        if (!st.canDelete) {
          const days = Math.max(1, Math.round(((st.untilBlock - st.block) * (await blockTimeSec().catch(() => 6))) / 86400));
          delNote.textContent = `Not yet: a paid subscription runs until block ${st.untilBlock.toLocaleString("en-US")} (about ${days} day${days === 1 ? "" : "s"}). You can delete the model once every subscription has ended.`;
          return;
        }
        delNote.textContent = "No subscription is running, so nobody is owed access. Deleting burns the NFT and removes the model from the registry, the marketplace and search, for good. The bytes already written to GenesisL1 storage stay readable to anyone who kept their address.";
        const typed = el("input", { type: "text", placeholder: "Type DELETE to confirm", "aria-label": "Type DELETE to confirm" });
        const del = el("button", { class: "btn2 danger", type: "button", text: "Delete this model" });
        del.addEventListener("click", () => {
          if (typed.value.trim() !== "DELETE") { say("Type DELETE to confirm."); return; }
          act("Delete", async () => { await deleteModel(m.tokenId); setTimeout(() => location.replace(new URL(`${ROOT}market.html`, location.href).href), 1500); });
        });
        delRow.append(typed, del);
      }).catch((e) => { delNote.textContent = `Could not check subscriptions: ${errText(e)}`; });
      // License: the admin may move it to a later version of the same license or open it up, never make it stricter.
      const licRow = el("div", { class: "row wrap" });
      body.append(el("h4", { class: "sub-h", text: "License" }), el("p", { class: "small muted" }, licenseNode(d.license), ". You can move it to a later version of the same license or open it up; it can never be made stricter, because rights already granted stay."), licRow);
      licenseCatalog(SET).then((cat) => {
        const options = licenseUpgradeOptions(d.license, cat.items);
        if (!options.length) { licRow.append(el("span", { class: "small muted", text: "No later version or more open license to move to." })); return; }
        const sel = el("select", { "aria-label": "New license" }, ...options.map((l) => el("option", { value: String(l.id), text: `${l.name}${l.spdx && l.spdx !== l.name ? ` · ${l.spdx}` : ""}` })));
        const change = el("button", { class: "btn2", type: "button", text: "Change license" });
        change.disabled = !LIVE;
        change.addEventListener("click", () => {
          const l = options.find((x) => String(x.id) === sel.value);
          if (l && confirm(`Move "${d.title}" to ${l.name}? This is recorded on-chain and cannot be undone: a license can only be opened up or moved to a later version.`)) act("License", () => changeModelLicense({ tokenId: d.tokenId, licenseId: l.id }));
        });
        licRow.append(sel, change);
      }).catch(() => {});
      // Settings
      const enabled = el("input", { type: "checkbox" }); enabled.checked = d.inferenceEnabled;
      const access = el("select", {}, ...ACCESS.map((t, k) => { const o = el("option", { value: String(k), text: t }); o.selected = k === d.pricingMode; return o; }));
      const fee = el("input", { type: "number", min: "0", step: "0.001", value: d.pricingMode ? eth().formatEther(d.feeWei) : "0.01" });
      const recipient = el("input", { value: d.feeRecipient && !/^0x0+$/.test(d.feeRecipient) ? d.feeRecipient : "", placeholder: "Your wallet (default)", spellcheck: "false" });
      const save = el("button", { class: "btn primary small", type: "button", text: "Save settings" });
      save.addEventListener("click", () => act("Settings", () => saveModelSettings({ tokenId: d.tokenId, enabled: enabled.checked, pricingMode: Number(access.value), feeWei: eth().parseEther(String(fee.value || "0")), recipient: recipient.value.trim() })));
      body.append(el("h4", { class: "sub-h", text: "Access and fees" }), el("div", { class: "fgrid" },
        el("div", { class: "field" }, el("label", { text: "Access" }), access), el("div", { class: "field" }, el("label", { text: "Fee per inference · L1" }), fee),
        el("div", { class: "field" }, el("label", { text: "Fee recipient" }), recipient)), el("label", { class: "check" }, enabled, el("span", { text: "Inference enabled" })), el("p", { class: "small muted", text: "Payments go to this recipient while you own the NFT; leave it empty for your own wallet. If you sell or transfer the NFT, it stops applying and payments go to the new owner." }), el("div", { class: "row end" }, save));
      // Plans
      const planRows = d.plans.map((p) => {
        const dur = el("input", { type: "number", min: "1", max: "3650", step: "1", value: blockSec ? String(Math.max(1, Math.round((p.durationBlocks * blockSec) / 86_400))) : "30" });
        const price = el("input", { type: "number", min: "0", step: "0.01", value: eth().formatEther(p.priceWei) });
        const on = el("input", { type: "checkbox" }); on.checked = p.active;
        const b = el("button", { class: "btn2", type: "button", text: "Update" });
        b.addEventListener("click", () => act(`Plan ${p.id}`, () => saveAccessPlan({ modelId: d.modelId, planId: p.id, durationBlocks: Math.round((Number(dur.value) * 86_400) / (blockSec || 6)), priceWei: eth().parseEther(String(price.value || "0")), active: on.checked })));
        return el("div", { class: "plan-row" }, el("span", { class: "plan-n", text: `Plan ${p.id}` }), el("label", { class: "plan-f" }, el("span", { text: "Days" }), dur), el("label", { class: "plan-f" }, el("span", { text: "Price · L1" }), price), el("label", { class: "check" }, on, el("span", { text: "Active" })), b);
      });
      const nd = el("input", { type: "number", min: "1", max: "3650", step: "1", value: "30" }), np = el("input", { type: "number", min: "0", step: "0.01", value: "1" });
      const add = el("button", { class: "btn2", type: "button", text: "Add plan" });
      add.disabled = d.pricingMode !== 2 || d.plans.length >= 255;
      add.addEventListener("click", () => act("New plan", () => saveAccessPlan({ modelId: d.modelId, durationBlocks: Math.round((Number(nd.value) * 86_400) / (blockSec || 6)), priceWei: eth().parseEther(String(np.value || "0")), active: true })));
      body.append(el("h4", { class: "sub-h", text: "Subscription plans" }), el("p", { class: "small muted", text: d.pricingMode === 2 ? "Plans sell time-limited access; payments go to the fee recipient." : "Switch access to Paid to sell subscription plans." }),
        el("div", { class: "plan-list" }, ...planRows, el("div", { class: "plan-row" }, el("span", { class: "plan-n", text: "New" }), el("label", { class: "plan-f" }, el("span", { text: "Days" }), nd), el("label", { class: "plan-f" }, el("span", { text: "Price · L1" }), np), add)));
      // Sale
      const saleRow = el("div", { class: "row wrap" });
      if (d.listing.listed) {
        const cancel = el("button", { class: "btn2", type: "button", text: `Cancel sale (${formatL1(d.listing.priceWei)})` });
        cancel.addEventListener("click", () => act("Cancel sale", () => cancelListing(d.tokenId)));
        saleRow.append(cancel);
      } else {
        const price = el("input", { type: "number", min: "0.01", step: "0.01", value: "10", "aria-label": "Sale price in L1" });
        const list = el("button", { class: "btn2", type: "button", text: "List for sale" });
        const feeWei = await listingFee(SET).catch(() => null);
        list.addEventListener("click", () => act("Listing", () => listForSale({ tokenId: d.tokenId, priceWei: eth().parseEther(String(price.value || "0")) })));
        saleRow.append(el("label", { class: "plan-f" }, el("span", { text: "Price · L1" }), price), list, el("span", { class: "small muted", text: feeWei === null ? "" : `Listing fee ${formatL1(feeWei)}, burnable by anyone.` }));
      }
      body.append(el("h4", { class: "sub-h", text: "Sell this model" }), el("p", { class: "small muted", text: "The buyer receives the NFT and becomes the model admin; the price is paid to you." }), saleRow);
      say(LIVE ? "" : "Preview: admin actions open when the GL1F Crypto contracts go live.");
      if (!LIVE) body.querySelectorAll("button, input, select").forEach((n) => { n.disabled = true; });
    } catch (e) { status.textContent = `Could not read this model (${errText(e)}).`; }
  });
  return box;
}
// ---------------- index pages: BUY on listed models ----------------
async function badgeCards() {
  const cards = [...document.querySelectorAll("[data-token-card]")];
  if (!cards.length || !LIVE || !globalThis.ethers || !setLive(SET)) return;
  const listings = await listingsFor(cards.map((c) => Number(c.dataset.tokenCard)), SET).catch(() => new Map());
  for (const c of cards) { const b = buyBadge(listings.get(Number(c.dataset.tokenCard))); const slot = c.querySelector(".buy-slot"); if (b && slot) slot.replaceChildren(b); }
}

// ---------------- the model page ----------------
const tokenId = Number(article?.dataset.token || new URLSearchParams(location.search).get("id"));
const status = (t) => { const n = $("#mp-status"); if (n) { n.textContent = t; n.hidden = !t; } };
function setShare(url, text) {
  $("#mp-url").textContent = url.replace(/^https?:\/\//, "");
  const enc = encodeURIComponent, links = { x: `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`, telegram: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`,
    whatsapp: `https://wa.me/?text=${enc(`${text} ${url}`)}`, linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` };
  for (const [k, href] of Object.entries(links)) { const a = $(`[data-mp-share="${k}"]`); if (a) a.href = href; }
  $("#mp-copy").onclick = async () => {
    try { await navigator.clipboard.writeText(url); } catch { const r = document.createRange(); r.selectNodeContents($("#mp-url")); getSelection().removeAllRanges(); getSelection().addRange(r); }
    const b = $("#mp-copy"); b.classList.add("done"); b.setAttribute("aria-label", "Link copied"); $("#mp-copied").hidden = false;
    setTimeout(() => { b.classList.remove("done"); b.setAttribute("aria-label", "Copy link to this model"); $("#mp-copied").hidden = true; }, 1800);
  };
}
// Pages for models published after the last site build are drawn here from the chain.
function fillDynamic(m) {
  const q = m.profile ? questionText(m.profile) : "", candle = m.profile?.candle || "";
  document.title = `${m.title}: Crypto AI model #${m.tokenId} | GL1F Crypto`;
  $("#mp-num").textContent = `Crypto AI model #${m.tokenId}`;
  $("#mp-title").textContent = m.title;
  $("#mp-market-label").textContent = m.profile ? `${m.profile.symbol || ""} · ${candle}` : "";
  $("#mp-question").textContent = q || m.title;
  $("#mp-lead").textContent = m.description || "A Crypto AI model on GenesisL1.";
  if (m.icon) $("#mp-icon").replaceChildren(el("img", { class: "model-icon", src: m.icon, alt: "", width: 88, height: 88 }));
  const open = !(m.internalsPrivate ?? m.pricingMode === 2);
  const meta = $("#mp-meta"); meta.querySelectorAll(".chip").forEach((n) => n.remove());
  meta.prepend(...[m.pricingMode === 2 ? "Paid · subscription" : m.pricingMode === 1 ? "Free to run · tips" : "Free to run", m.license?.name, open ? `${m.nFeatures} signals` : null]
    .filter(Boolean).map((t) => el("span", { class: "chip", text: t })));
  if (candle) $("#mp-run-desc").textContent = `It answers the question above for the latest completed ${candle} candle: your browser computes the inputs from public exchange data, and the model answers on GenesisL1.`;
  const url = modelPage(m.tokenId, ROOT), desc = `${m.title}: ${q ? (/[.?!]$/.test(q) ? q : `${q}.`) : "a Crypto AI model on GenesisL1."} Run it on the latest candle, see its access and price, share it.`;
  setShare(url, `${m.title}: ${q || "a Crypto AI model on GenesisL1."}`);
  const canon = document.querySelector('link[rel="canonical"]'); if (canon) canon.href = url;
  const metaTag = (sel, val) => document.querySelectorAll(sel).forEach((n) => n.setAttribute("content", val));
  metaTag('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]', desc);
  metaTag('meta[property="og:title"], meta[name="twitter:title"]', document.title);
  metaTag('meta[property="og:url"]', url);
  if (!document.querySelector("script[data-mp-ld]")) {
    const ld = el("script", { type: "application/ld+json", "data-mp-ld": true });
    ld.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "CreativeWork", name: m.title, description: desc, url, ...(m.license?.url ? { license: m.license.url } : {}),
      keywords: ["Crypto AI model", m.profile?.symbol, "GenesisL1"].filter(Boolean).join(", "), isPartOf: { "@type": "WebSite", name: "GL1F Crypto", url: new URL(ROOT, location.href).href } });
    document.head.append(ld);
  }
  $("#mp-spec").replaceChildren(dlRow("Question", q || "—"), dlRow("Market", m.profile ? `${m.profile.symbol} · ${candle}` : "—"), dlRow("Access", ACCESS[m.pricingMode] || "—"),
    ...(open ? [dlRow("Signals", String(m.nFeatures)), dlRow("Trees", `${m.nTrees} × depth ${m.depth}`)] : [dlRow("Internals", "Private")]),
    dlRow("Creator", m.creator || "—", "mono"), dlRow("Token", `#${m.tokenId} on GenesisL1 (chain 29)`), dlRow("License", licenseNode(m.license)));
}
async function refreshLive() {
  try {
    details = await modelDetails(tokenId, SET);
    blockSec ??= await blockTimeSec().catch(() => null);
    if (article?.dataset.dynamic) fillDynamic(details);
    const d = details, isOwner = !!wallet && d.owner.toLowerCase() === wallet.toLowerCase();
    const hb = $("#mp-buy"), badge = buyBadge(d.listing, d.listing.listed && !isOwner ? "#mp-market" : null);
    hb.replaceChildren(...(badge ? [badge] : [])); hb.hidden = !badge;
    const listed = d.listing.listed, parts = [];
    if (listed) parts.push(el("div", { class: "mp-price" }, el("span", { text: isOwner ? "You listed it for" : "For sale" }), el("b", { text: formatL1(d.listing.priceWei) })));
    if (d.listing.listed && !isOwner) {
      const buy = el("button", { class: "btn hype mp-buy-btn", type: "button", text: "Buy this model" });
      buy.addEventListener("click", async () => {
        if (!(await ensureTerms())) return;
        if (!confirm(`Buy the Crypto AI Model NFT "${d.title}" for ${formatL1(d.listing.priceWei)}? You become its model admin. Blockchain transactions are final.`)) return;
        try { if (!wallet) { await connectWallet(); await refreshWallet(); } status("Purchase: confirm in your wallet…"); await buyListing({ tokenId: d.tokenId, priceWei: d.listing.priceWei }); status("Bought. You are now the model admin."); await refreshLive(); }
        catch (e) { status(""); showError($("#mp-error"), errText(e)); }
      });
      parts.push(buy, el("p", { class: "mp-fine", text: "You become its model admin: you set its access and fees, and its income goes to you." }));
    }
    parts.push(el("dl", { class: "mp-dl" }, dlRow("Access", `${ACCESS[d.pricingMode] || "—"}${d.pricingMode ? ` · ${formatL1(d.feeWei)} per run` : " · no fee"}`),
      dlRow("Model admin", `${shortHex(d.owner, 8, 6)}${isOwner ? " · you" : ""}`, "mono"), ...(listed ? [] : [dlRow("Sale", "Not listed")]), dlRow("License", licenseNode(d.license))));
    const plans = d.plans.filter((p) => p.active);
    if (plans.length) {
      parts.push(el("h3", { class: "sub-h", text: "Subscription plans" }), el("div", { class: "mp-plans" },
        ...plans.map((p) => {
          const sub = el("button", { class: "btn2 small", type: "button", text: "Subscribe" });
          sub.disabled = d.pricingMode !== 2;
          sub.addEventListener("click", async () => {
            if (!(await ensureTerms())) return;
            if (!confirm(`Subscribe to "${d.title}" for ${days(p.durationBlocks)} at ${formatL1(p.priceWei)}? The payment goes to the model admin and is final.`)) return;
            try {
              if (!wallet) { await connectWallet(); await refreshWallet(); }
              status("Subscription: confirm in your wallet…");
              await buyAccessPlan({ modelId: d.modelId, planId: p.id, priceWei: p.priceWei, key: wallet });
              const until = await accessUntil(d.modelId, wallet, SET).catch(() => 0);
              status(`Subscribed: you can run this model until block ${Number(until).toLocaleString("en-US")}.`);
            } catch (e) { status(""); showError($("#mp-error"), errText(e)); }
          });
          return el("div", { class: "mp-plan" }, el("div", {}, el("b", { text: formatL1(p.priceWei) }), el("span", { text: `${days(p.durationBlocks)} · plan ${p.id}` })), sub);
        })));
    }
    $("#mp-market-body").replaceChildren(...parts);
    const paid = d.pricingMode === 2, pill = $("#mp-run-pill");
    pill.textContent = paid ? "Paid · subscription" : "Free · no wallet, no gas"; pill.classList.toggle("paid", paid);
    $("#mp-run-note").textContent = paid ? (isOwner ? "As its admin you run it with a wallet signature, at no cost." : "Subscribe to a plan, then run it with a wallet signature (no gas).") : "";
    const adminBox = $("#mp-admin");
    adminBox.hidden = !isOwner;
    if (isOwner && !adminBox.dataset.ready) { const panel = adminPanel({ ...d }); adminBox.replaceChildren(el("h2", { text: "Manage this model" }), panel); adminBox.dataset.ready = "1"; panel.open = true; }
  } catch (e) { $("#mp-market-body").replaceChildren(el("p", { class: "small muted", text: `Could not read this model from GenesisL1 (${errText(e)}).` })); }
}
// The Yes range: Yes when "from" <= probability <= "to" (defaults 0.50 and 1.00). A link can preset it with
// ?threshold=0.6&threshold_max=0.85. Changing it re-decides the answer on screen without running the model again.
let lastAnswer = null;
const pctText = (v) => `${+(v * 100).toFixed(1)}%`;
function readRange() {
  try { return yesRange({ threshold: $("#mp-thr").value, thresholdMax: $("#mp-thr-max").value }); } catch { return null; }
}
function showRange() {
  const r = readRange(), note = $("#mp-thr-note"), bad = !r;
  $("#mp-thr").setAttribute("aria-invalid", String(bad)); $("#mp-thr-max").setAttribute("aria-invalid", String(bad));
  note.classList.toggle("bad", bad);
  note.textContent = bad ? "Use two numbers from 0 to 1, the first not above the second." : isDefaultRange(r) ? "The default: Yes at 50% or more."
    : r.thresholdMax >= 1 ? `Yes at ${pctText(r.threshold)} or more.` : `Yes from ${pctText(r.threshold)} to ${pctText(r.thresholdMax)}.`;
  $("#mp-thr-reset").hidden = bad ? false : isDefaultRange(r);
  if (lastAnswer && r) renderAnswer(lastAnswer, r);
  return r;
}
function renderAnswer(a, range) {
  const { r, q, c, when } = a, d = decide(r.probability, range), yes = d.yes, pct = (r.probability * 100).toFixed(1), plain = isDefaultRange(d);
  const lo = d.threshold * 100, hi = d.thresholdMax * 100;
  const why = plain ? `${yes ? "50% or more" : "under 50%"}, so its answer is ${yes ? "yes" : "no"}.`
    : d.thresholdMax >= 1 ? `${yes ? "at least" : "under"} your ${pctText(d.threshold)} threshold, so its answer is ${yes ? "yes" : "no"}.`
    : `${yes ? "inside" : "outside"} your Yes range of ${pctText(d.threshold)} to ${pctText(d.thresholdMax)}, so its answer is ${yes ? "yes" : "no"}.`;
  $("#mp-result").replaceChildren(el("div", { class: `mp-answer ${yes ? "yes" : "no"}` },
    el("div", { class: "mp-answer-top" },
      el("div", { class: "mp-verdict" }, el("span", { class: "mp-dot", "aria-hidden": "true" }), el("span", { text: yes ? "Yes" : "No" })),
      el("div", { class: "mp-prob" }, el("b", { text: `${pct}%` }), el("span", { text: "probability" }))),
    el("div", { class: "mp-meter", role: "img", "aria-label": `${pct}% on a scale where ${plain ? "50% and above" : d.thresholdMax >= 1 ? `${pctText(d.threshold)} and above` : `${pctText(d.threshold)} to ${pctText(d.thresholdMax)}`} means yes` },
      el("span", { class: "mp-meter-band", style: `left: ${lo}%; width: ${Math.max(0, hi - lo)}%` }),
      el("i", { style: `width: ${Math.max(1.5, Math.min(100, r.probability * 100))}%` }),
      el("span", { class: "mp-meter-mid", style: `left: ${lo}%` }),
      d.thresholdMax < 1 ? el("span", { class: "mp-meter-mid", style: `left: ${hi}%` }) : null),
    el("div", { class: "mp-meter-scale", "aria-hidden": "true" }, el("span", { text: "0%" }), el("span", { text: plain ? "50%" : d.thresholdMax >= 1 ? `Yes from ${pctText(d.threshold)}` : `Yes ${pctText(d.threshold)}–${pctText(d.thresholdMax)}` }), el("span", { text: "100%" })),
    el("p", { class: "mp-answer-text" }, q ? el("b", { text: `${q} ` }) : null, `The model gives it ${pct}%, ${why}`),
    el("p", { class: "mp-answer-meta", text: `For the ${c} candle that closed ${when} UTC · answered on GenesisL1 (${r.via}, score ${r.scoreQ}) · educational, not investment advice` })));
}
async function runModel() {
  const btn = $("#mp-run-btn"), out = $("#mp-result");
  const wait = (text) => out.replaceChildren(el("p", { class: "mp-result-empty busy", text }));
  const range = showRange();
  if (!range) { showError($("#mp-error"), "Set the Yes range first: two numbers from 0 to 1, the first not above the second."); return; }
  showError($("#mp-error"), null); btn.disabled = true; lastAnswer = null;
  wait("Computing the inputs on the latest completed candle from public exchange data…");
  try {
    const gl1f = apiClient(SET), model = await gl1f.model(tokenId);
    engine ??= await GL1FCrypto.browserEngine(new URL(`${ROOT}sdk/gl1f-engine.js`, location.href).href);
    const inputs = await gl1f.latestInputs(model, { engine });
    let opts = {};
    if (model.pricingMode === 2) {
      if (!wallet) { await connectWallet(); await refreshWallet(); }
      const signer = await walletSigner(), owner = details?.owner?.toLowerCase() === wallet?.toLowerCase();
      if (owner) opts = { owner: signer };
      else if ((await gl1f.accessStatus(model, wallet)).active) opts = { accessKey: signer };
      else throw new Error("This model is paid: subscribe to a plan to run it.");
    }
    wait("Asking the model on GenesisL1…");
    const r = await gl1f.predict(model, inputs.valuesQ, opts);
    const c = String(model.profile?.candle || "15m"), mins = parseInt(c, 10) * ({ m: 1, h: 60, d: 1440, w: 10080 }[c.slice(-1)] || 1);
    const when = new Date(Number(inputs.selectedOpenMs) + mins * 60_000).toISOString().slice(0, 16).replace("T", " ");
    lastAnswer = { r, q: details?.profile ? questionText(details.profile) : "", c, when };
    renderAnswer(lastAnswer, readRange() || range);
  } catch (e) { out.replaceChildren(el("p", { class: "mp-result-empty", text: "No answer this time: see the message above." })); showError($("#mp-error"), errText(e)); }
  finally { btn.disabled = false; }
}
async function refreshWallet() {
  try { const st = await walletState(); wallet = st.address || null; } catch { wallet = null; }
  const w = $("#mp-wallet"); if (w) w.textContent = wallet ? shortHex(wallet, 6, 4) : "Connect wallet";
}

badgeCards();
if (article && tokenId > 0) {
  $("#mp-num").textContent = $("#mp-question").textContent = `Crypto AI model #${tokenId}`;
  const url = modelPage(tokenId, ROOT), title = $("#mp-title")?.textContent || `Crypto AI model #${tokenId}`;
  setShare(url, `${title}: a Crypto AI model on GenesisL1.`);
  $("#mp-run-btn").addEventListener("click", runModel);
  {
    const q = new URLSearchParams(location.search), set = (sel, v) => { if (v !== null && v !== "" && Number.isFinite(Number(v))) $(sel).value = Number(v).toFixed(2); };
    set("#mp-thr", q.get("threshold")); set("#mp-thr-max", q.get("threshold_max"));
    for (const sel of ["#mp-thr", "#mp-thr-max"]) $(sel).addEventListener("input", showRange);
    $("#mp-thr-reset").addEventListener("click", () => { $("#mp-thr").value = "0.50"; $("#mp-thr-max").value = "1.00"; showRange(); });
    showRange();
  }
  $("#mp-studio").href = new URL(`${ROOT}app.html?model=${tokenId}#infer`, location.href).href;
  $("#mp-wallet")?.addEventListener("click", async () => { try { await connectWallet(); } catch (e) { showError($("#mp-error"), errText(e)); } await refreshWallet(); refreshLive(); });
  if (!LIVE || !globalThis.ethers || !setLive(SET)) {
    $("#mp-market-body").replaceChildren(el("p", { class: "small muted", text: LIVE ? "GenesisL1 could not be reached from this page." : "The GL1F Crypto contracts are not live yet." }));
    $("#mp-run-btn").disabled = true;
    $("#mp-lead").textContent = "This model's details are read from GenesisL1, which could not be reached from this page.";
  } else {
    refreshWallet().then(refreshLive);
    try { onWalletChange(() => refreshWallet().then(refreshLive)); } catch { /* no wallet */ }
  }
} else if (article) {
  $("#mp-question").textContent = "This Crypto AI model was not found";
  $("#mp-lead").textContent = "Check the link, or browse all Crypto AI models in the marketplace.";
}
