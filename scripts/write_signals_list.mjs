// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Writes SIGNALS.txt and site/signals.txt: every signal the studio offers, with its plain name, machine name, group and meaning.
import { writeFileSync, readFileSync } from "node:fs";
import { loadMarketWorker } from "./lib/market_worker_node.mjs";
const { ALL_FEATURES, featureGroup, featureNote } = loadMarketWorker();
import { WORLD_META } from "../src/studio/world_signals.js";
import { SOURCES } from "../src/studio/world_sources.js";
import { featureLabel } from "../src/studio/feature_labels.js";
const V = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const ORDER = ["Returns & position", "Trend & momentum", "Volatility", "Volume & flow", "Candle structure", "Funding", "BTC context", "Calendar", "Holidays & events", "Astronomy", "Macro & markets", "Disasters & conflict"];
const groups = new Map(ORDER.map((g) => [g, []]));
for (const name of ALL_FEATURES) { const g = featureGroup(name); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(name); }
const source = (name) => WORLD_META[name] ? (WORLD_META[name].needs.length ? `live public data: ${[...new Set(WORLD_META[name].needs.map((k) => SOURCES[k].via))].join(", ")}` : "computed from the candle time") : "exchange candles";
let text = `GL1F Crypto: all signals (${ALL_FEATURES.length})\nStudio version ${V}. Format: Plain name (machine name): what it measures [source].\n` +
  "Machine names are what a model stores; the studio shows the plain name first.\nEvery value uses only what was known when the candle closed. Every signal has years of history (shown as History from ...).\n";
for (const [g, names] of groups) {
  if (!names.length) continue;
  text += `\n== ${g} (${names.length}) ==\n` + names.map((n) => `${featureLabel(n)} (${n}): ${featureNote(n)} [${source(n)}]`).join("\n") + "\n";
}
text += `\nSources (everything loads in the browser; nothing to install)\n- Exchange candles: Binance, Coinbase and Hyperliquid.\n` +
  `- Computed from the candle time: US market holidays (NYSE rules), Fed decision dates, elections, Asian holidays, expiries; Moon and planets from JPL approximate orbital elements and a low-precision lunar theory.\n` +
  `- Live public data, fetched when a dataset is built: DBnomics (Federal Reserve H.15 Treasury yields and fed funds, BLS unemployment); DataHub on GitHub (EIA oil and natural gas, BLS CPI, Federal Reserve H.10 exchange rates for the dollar index, Cboe VIX, Robert Shiller's S&P 500, gold); USGS earthquakes; NASA EONET tropical storms; Wikipedia pageviews (from July 2015).\n` +
  `- If a live source cannot be reached, the studio uses the copy the GL1F Crypto site publishes at data/world.json.\n` +
  `- Daily series count from 2 days after their date; monthly CPI from 45 days, unemployment, S&P 500 and gold from 40 days after the month; events from the day before.\n`;
writeFileSync(new URL("../SIGNALS.txt", import.meta.url), text);
writeFileSync(new URL("../site/signals.txt", import.meta.url), text);
console.log(`signals list: ${ALL_FEATURES.length} signals in ${[...groups.values()].filter((x) => x.length).length} groups`);
