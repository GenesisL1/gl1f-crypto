// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Home page: theme, search, tabs, the hero car (still render first, live 3D once it has drawn) and live models.
import { initSite } from "../studio/site.js";
import { buyBadge, formatL1 } from "../studio/ui.js";
import { listModels, setLive, listingsFor, modelPage } from "../studio/chain.js";

initSite();

const stage = document.getElementById("car-stage"), host = document.getElementById("car3d"), note = document.getElementById("car-note");
function unavailable(reason) {
  if (host) host.hidden = true;
  if (note) { note.textContent = `Interactive 3D is unavailable here (${reason}), so this is a still render.`; note.hidden = false; }
}
function hasWebGL2() {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch { return false; }
}
function mountCar() {
  try {
    host.car3d = window.GL1FCar3D.mountCar(host, { yaw: -0.25, elev: 0.2 });
    if (!host.car3d) unavailable("WebGL could not start");
  } catch (error) { unavailable(error?.message || "3D engine error"); }
}
if (stage && host) {
  if (!hasWebGL2()) unavailable("WebGL 2 is turned off in this browser");
  else {
    const self = document.querySelector('script[src*="js/home.js"]');
    const script = document.createElement("script");
    script.src = self ? self.src.replace("/home.js", "/car3d.js") : "./js/car3d.js";
    script.async = true;
    script.onload = mountCar;
    script.onerror = () => unavailable("the 3D engine did not load");
    document.head.append(script);
  }
}

// ---------- Explore: published models read live from GenesisL1 ----------
const grid = document.getElementById("models-grid"), modelsNote = document.getElementById("models-note");
const ACCESS = ["Free", "Tips", "Paid"];
function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
function modelCard(m) {
  // The whole card opens the model's own page (model.html?id=<n>).
  const card = el("a", "model-card lift");
  card.href = modelPage(m.tokenId);
  const head = el("div", "head"), pic = m.icon ? el("img") : el("div", "ph");
  if (m.icon) { pic.src = m.icon; pic.alt = ""; pic.loading = "lazy"; pic.width = 52; pic.height = 52; }
  const title = el("div", "title"), access = `${ACCESS[m.pricingMode] || "—"}${m.pricingMode && m.feeWei ? ` · ${formatL1(m.feeWei)} / run` : ""}`;
  title.append(el("b", "", m.title), el("span", "", `#${m.tokenId} · ${access}${m.profile?.symbol ? ` · ${m.profile.symbol}` : ""}`));
  head.append(pic, title);
  const stats = el("div", "stats");
  if (m.internalsPrivate ?? Number(m.pricingMode) === 2) { const cell = el("div"); cell.append(el("b", "", "Private"), el("span", "", "model internals")); stats.append(cell); }
  else for (const [value, label] of [[m.nTrees, "trees"], [`d${m.depth}`, "depth"], [m.nFeatures, "signals"]]) { const cell = el("div"); cell.append(el("b", "", String(value)), el("span", "", label)); stats.append(cell); }
  const foot = el("div", "card-actions");
  foot.append(el("span", "buy-slot"), el("span", "card-go", "View model →"));
  card.append(head, stats, foot);
  return card;
}
function say(text) { modelsNote.textContent = text; modelsNote.hidden = false; }
async function loadModels() {
  const set = "crypto";
  if (!window.ethers || !setLive(set)) { grid.replaceChildren(); say(setLive(set) ? "GenesisL1 could not be reached from this page." : "Published Crypto AI models appear here once the GL1F Crypto contracts are live."); return; }
  try {
    const page = await listModels({ limit: 5, set });
    grid.replaceChildren(...page.items.map(modelCard));
    // Listed models show BUY and their price (only the models on screen are read).
    listingsFor(page.items.map((m) => m.tokenId)).then((listings) => page.items.forEach((m, k) => { const badge = buyBadge(listings.get(Number(m.tokenId))); if (badge) grid.children[k]?.querySelector(".buy-slot")?.replaceChildren(badge); })).catch(() => {});
    if (!page.items.length) say("No models yet. Be the first to publish one.");
    else say(`${page.total} Crypto AI model${page.total === 1 ? "" : "s"} on GL1F Crypto.`);
  } catch (error) {
    grid.replaceChildren();
    say(`Models could not be read from GenesisL1 right now (${error?.shortMessage || error?.message || error}).`);
  }
}
if (grid) {
  const section = document.getElementById("models");
  if ("IntersectionObserver" in window && section) {
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { io.disconnect(); loadModels(); } }, { rootMargin: "600px" });
    io.observe(section);
  } else loadModels();
}
