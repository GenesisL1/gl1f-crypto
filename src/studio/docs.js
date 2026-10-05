// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Docs page: contract addresses, live fee and model statistics, and the public fee burn.
import { initSite, initHelp } from "./site.js";
import { HELP } from "./help_texts.js";
import { $, fmtInt, fmtBytes, shortHex, segmented } from "./ui.js";
import { contractSet, cryptoLive, setLive, feeStats, modelStats, burnFees, explorerTx, licenseCatalog, protocolOwners, termsOnChain } from "./chain.js";
import { barsHtml } from "./charts.js";

initSite();
initHelp(HELP);

const cfg = globalThis.GL1F_RUNTIME || {};
const explorer = cfg.network?.explorer || "https://explorer.genesisl1.org";
const NAMES = { store: "ModelStore", registry: "CryptoModelRegistry", nft: "ModelNFT · GL1FC", runtime: "ForestRuntime", market: "CryptoModelMarketplace" };
const l1 = (wei) => {
  if (wei === null || wei === undefined) return "—";
  const v = Number(wei) / 1e18;
  if (v === 0) return "0 L1";
  if (v < 0.0001) return `${Number(wei).toLocaleString("en-US")} wei`;
  return `${v.toLocaleString("en-US", { maximumFractionDigits: 6 })} L1`;
};
function cell(content) {
  const td = document.createElement("td");
  if (content instanceof Node) td.append(content); else td.textContent = content;
  return td;
}
function link(href, text) { const a = document.createElement("a"); a.href = href; a.textContent = text; a.target = "_blank"; a.rel = "noopener"; a.className = "addr"; return a; }
function contractTable(table, set, names) {
  const { addresses, hashes } = contractSet(set);
  table.replaceChildren();
  const head = document.createElement("tr");
  for (const h of ["Contract", "Address", "Runtime code hash"]) { const th = document.createElement("th"); th.textContent = h; head.append(th); }
  table.append(head);
  for (const [key, name] of Object.entries(names)) {
    const tr = document.createElement("tr"), a = addresses?.[key];
    tr.append(cell(name), cell(a ? link(`${explorer}/address/${a}`, a) : "Pending deployment"), cell(hashes?.[key] ? shortHex(hashes[key], 10, 8) : "—"));
    tr.firstChild.className = "name";
    table.append(tr);
  }
}

const live = cryptoLive();
const status = $("#docs-status");
status.textContent = live ? "Contracts live" : "Contracts pending";
status.classList.toggle("pending", !live);
contractTable($("#docs-contracts"), "crypto", NAMES);
$("#docs-contracts-note").textContent = live
  ? "Code hashes are verified by the app before every read and transaction."
  : "The GL1F Crypto contracts are compiled and tested and will be deployed to GenesisL1; addresses and code hashes appear here once they are live. Until then the studio can train, backtest and run models locally, and read the original GL1F registry.";

async function loadFees() {
  if (!live) {
    for (const id of ["pending-registry", "pending-market"]) $(`#${id}`).textContent = "—";
    return;
  }
  try {
    const f = await feeStats();
    $("#fee-creation").textContent = l1(f.registry.creationFeeWei); $("#fee-creation-note").textContent = "per model, burnable";
    $("#fee-byte").textContent = l1(f.registry.sizeFeeWeiPerByte); $("#fee-byte-note").textContent = "per stored byte, burnable";
    $("#fee-listing").textContent = f.market ? l1(f.market.listingFeeWei) : "—"; $("#fee-listing-note").textContent = "per listing, burnable";
    const example = f.registry.creationFeeWei + f.registry.sizeFeeWeiPerByte * 50_000n;
    $("#fee-example").textContent = `Example: a 50 KB model costs ${l1(example)} in protocol fees, plus network gas.`;
    $("#pending-registry").textContent = l1(f.registry.pendingWei);
    $("#burn-registry").disabled = f.registry.pendingWei === 0n;
    $("#pending-market").textContent = f.market ? l1(f.market.pendingWei) : "—";
    $("#burn-market").disabled = !f.market || f.market.pendingWei === 0n;
    return f;
  } catch (error) {
    $("#fee-example").textContent = `Could not read fees: ${error?.shortMessage || error?.message || error}`;
    return null;
  }
}

async function loadStats(set) {
  const grid = $("#stats-models"), note = $("#stats-note");
  note.hidden = true;
  grid.replaceChildren();
  if (!setLive(set) || !globalThis.ethers) {
    note.textContent = set === "crypto" ? "The GL1F Crypto contracts are not deployed yet. Switch to “GL1F (original)” to see the live GenesisL1 registry." : "GenesisL1 is unavailable: the wallet library did not load.";
    note.hidden = false;
    barsHtml($("#stats-mix"), []); barsHtml($("#stats-fees"), []);
    $("#stats-latest").replaceChildren();
    return;
  }
  $("#stats-block").textContent = "Loading…";
  try {
    const [m, f] = await Promise.all([modelStats(set, { max: 500 }), set === "crypto" ? feeStats() : Promise.resolve(null)]);
    const stat = (label, value, help) => { const d = document.createElement("div"); d.className = "stat"; const v = document.createElement("span"); v.className = "v"; v.textContent = value; const k = document.createElement("span"); k.className = "k"; k.textContent = label; if (help) k.dataset.help = help; d.append(v, k); return d; };
    grid.append(
      stat("Models minted", fmtInt(m.total)), stat("Live models", fmtInt(m.live)), stat("Free", fmtInt(m.free)), stat("Tips", fmtInt(m.tips)),
      stat("Paid", fmtInt(m.paid)), stat("Creators", fmtInt(m.creators)), stat("Trees on-chain", fmtInt(m.trees)),
      ...(f ? [stat("Bytes stored", fmtBytes(f.registry.bytes)), stat("Fees collected", l1(f.registry.collectedWei + (f.market?.collectedWei || 0n))),
        stat("Fees burned", l1(f.registry.burnedWei + (f.market?.burnedWei || 0n))), stat("Waiting to burn", l1(f.registry.pendingWei + (f.market?.pendingWei || 0n)), "docs.pending"),
        stat("Burn calls", fmtInt(f.registry.burns + (f.market?.burns || 0)))] : []),
    );
    barsHtml($("#stats-mix"), [
      { label: "Free", value: m.free, text: fmtInt(m.free), tone: "good" }, { label: "Tips", value: m.tips, text: fmtInt(m.tips) },
      { label: "Paid", value: m.paid, text: fmtInt(m.paid), tone: "warn" }, { label: "Removed", value: m.removed, text: fmtInt(m.removed), tone: "bad" },
    ]);
    if (f) {
      const burned = f.registry.burnedWei + (f.market?.burnedWei || 0n), toL1 = (w) => Number(w) / 1e18;
      barsHtml($("#stats-fees"), [
        { label: "Creation", value: toL1(f.registry.creationWei), text: l1(f.registry.creationWei) },
        { label: "Per-byte", value: toL1(f.registry.sizeWei), text: l1(f.registry.sizeWei) },
        { label: "Listing", value: toL1(f.market?.collectedWei || 0n), text: l1(f.market?.collectedWei || 0n) },
        { label: "Burned", value: toL1(burned), text: l1(burned), tone: "bad" },
      ]);
    } else {
      $("#stats-fees").textContent = "Fee and burn statistics appear once the GL1F Crypto contracts are live.";
    }
    const t = $("#stats-latest");
    t.replaceChildren();
    const head = document.createElement("tr");
    for (const h of ["#", "Model", "Access", "Trees", "Signals"]) { const th = document.createElement("th"); th.textContent = h; head.append(th); }
    t.append(head);
    for (const r of m.latest) {
      const tr = document.createElement("tr");
      tr.append(cell(String(r.tokenId)), cell(r.title), cell(["Free", "Tips", "Paid"][r.pricingMode] || "—"), cell(`${r.nTrees} × d${r.depth}`), cell(String(r.nFeatures)));
      tr.children[1].className = "name";
      t.append(tr);
    }
    $("#stats-latest-hint").textContent = `${fmtInt(m.scanned)} scanned`;
    $("#stats-block").textContent = f ? `Block ${fmtInt(f.block)}.` : "";
  } catch (error) {
    $("#stats-block").textContent = "";
    note.textContent = `Could not read chain stats: ${error?.shortMessage || error?.message || error}`;
    note.hidden = false;
  }
}

async function burn(which) {
  const out = $("#burn-result"), button = $(which === "market" ? "#burn-market" : "#burn-registry");
  button.disabled = true; out.hidden = false; out.className = "alert info"; out.textContent = "Confirm the burn in your wallet…";
  try {
    const r = await burnFees(which);
    out.className = "alert info";
    out.replaceChildren(document.createTextNode(`Burned ${l1(r.amountWei)}. `), link(explorerTx(r.hash), "View transaction"));
    await loadFees(); await loadStats(statsSet.value);
  } catch (error) {
    out.className = "alert"; out.textContent = error?.code === 4001 ? "Request rejected in the wallet." : (error?.shortMessage || error?.message || String(error));
    button.disabled = false;
  }
}
$("#burn-registry").addEventListener("click", () => burn("registry"));
$("#burn-market").addEventListener("click", () => burn("market"));

loadFees();
loadStats("crypto");

// Licenses and protocol owners, read from the chain once the contracts are live.
if (live) {
  licenseCatalog().then((c) => {
    const d = c.items.find((l) => l.id === c.defaultId);
    if (d) $("#lic-default").textContent = d.name;
    document.querySelectorAll("[data-lic]").forEach((row) => {
      const l = c.items.find((x) => x.spdx === row.dataset.lic);
      row.classList.toggle("is-default", !!l && l.id === c.defaultId);
      row.classList.toggle("is-off", !!l && !l.selectable);
    });
  }).catch(() => {});
  termsOnChain().then((t) => { if (t) $("#terms-onchain").textContent = `version ${t.version}, recorded on-chain (hash ${shortHex(t.hash, 10, 8)})`; }).catch(() => {});
  protocolOwners().then((o) => {
    if (!o) return;
    const who = (x) => `${x.owner}${x.pending ? ` (handover to ${x.pending} waiting for acceptOwnership)` : ""}`;
    $("#admin-owners").textContent = `Current owner of the registry: ${who(o.registry)}${o.market ? `; of the marketplace: ${who(o.market)}` : ""}.`;
  }).catch(() => {});
}
