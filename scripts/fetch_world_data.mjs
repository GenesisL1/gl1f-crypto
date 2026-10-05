// MIT License — Copyright (c) 2026 Decentralized Science Labs
// The site's scheduled job (never something a user runs): fetches the same public data the studio loads live in the
// browser (src/studio/world_sources.js) into site/data/world.json. The studio reads that copy only for a source the
// browser cannot reach. S&P 500 and VIX are not copied unless GL1F_INCLUDE_LICENSED=1 (publishing them needs rights);
// browsers still load them live from their public source.
// Usage in CI: node scripts/fetch_world_data.mjs [--force]   (at most every GL1F_WORLD_MAX_AGE_HOURS, default 6)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { fetchLiveWorld, hasWorldKey, mergeWorldKey, SOURCES } from "../src/studio/world_sources.js";
export const START = "2016-01-01";
const DAY = 86_400_000;
export async function buildWorld({ fetchImpl = globalThis.fetch, old = {}, includeLicensed = false, now = new Date(), log = console.log, warn = console.warn } = {}) {
  const keys = Object.keys(SOURCES).filter((k) => includeLicensed || !SOURCES[k].licensed);
  const { world, errors } = await fetchLiveWorld({ keys, fromDay: Math.floor(Date.parse(`${START}T00:00:00Z`) / DAY), toDay: Math.floor(now.getTime() / DAY), fetchImpl });
  for (const k of keys) {
    if (!errors[k]) { log(`ok   ${k}: ${SOURCES[k].via}`); continue; }
    if (hasWorldKey(old, k)) { mergeWorldKey(world, old, k); world.sources[k] = old.sources?.[k] || SOURCES[k].via; }
    warn(`kept ${k}: ${errors[k]}`);
  }
  const failed = Object.keys(errors).length;
  return { out: { schema: "gl1f-world/v2", updated: failed === keys.length ? old.updated || null : now.toISOString(), start: START, ...world, errors }, failed, total: keys.length };
}
async function main() {
  const OUT = new URL("../site/data/world.json", import.meta.url);
  const old = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  const maxAge = Number(process.env.GL1F_WORLD_MAX_AGE_HOURS || 6) * 3600_000;
  if (!process.argv.includes("--force") && old.updated && Date.now() - Date.parse(old.updated) < maxAge) { console.log(`world data copy is fresh (${old.updated}); nothing to do`); return; }
  const { out, failed, total } = await buildWorld({ old, includeLicensed: process.env.GL1F_INCLUDE_LICENSED === "1" });
  mkdirSync(new URL("../site/data/", import.meta.url), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
  console.log(`world data copy written: ${Object.keys(out.series).length} series, ${out.quakes.length} earthquakes, ${out.storms.length} storms, ${out.events.length} natural events, ${out.warViews.length} days of war attention; ${failed} of ${total} source(s) kept from before`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
