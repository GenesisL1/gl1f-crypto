// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Builds site/js/*.js as classic scripts (no ES modules at runtime), so the site works on any static
// host and when opened from disk. Workers are embedded as text and started from blob: URLs.
import { build } from "esbuild";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const banner = (what) => ({ js: `/*! GL1F Crypto ${what} v${pkg.version}. MIT License, Copyright (c) 2026 Decentralized Science Labs. Source: https://github.com/GenesisL1/gl1f-crypto */` });
const common = { bundle: true, format: "iife", minify: true, target: "es2020", legalComments: "inline", charset: "utf8", logLevel: "warning", external: ["node:vm", "node:fs"] };

const trainWorker = await build({ ...common, entryPoints: ["src/studio/train_worker.js"], write: false });
// World signals are compiled to a classic script (global GL1F_WORLD) and prepended to the market worker.
const worldLib = await build({ ...common, entryPoints: ["src/studio/world_signals.js"], globalName: "GL1F_WORLD", write: false });
// Web3 API: the SDK (one ES module) and the market engine as a standalone script, published under site/sdk/.
const engineSource = worldLib.outputFiles[0].text + "\n" + readFileSync("src/studio/market_worker.js", "utf8");
mkdirSync("site/sdk", { recursive: true });
writeFileSync("site/sdk/gl1f-engine.js", "/* GL1F Crypto market engine (MIT): the signal code the studio runs, for the Web3 API. */\n" + engineSource);
await build({ ...common, entryPoints: ["src/sdk/gl1f-crypto.js"], outfile: "site/sdk/gl1f-crypto.js", format: "esm", globalName: undefined, minify: false, external: ["node:vm", "node:fs"] });
const define = {
  __MARKET_WORKER__: JSON.stringify(engineSource),
  __TRAIN_WORKER__: JSON.stringify(trainWorker.outputFiles[0].text),
};
await build({ ...common, entryPoints: ["src/pages/home.mjs"], outfile: "site/js/home.js", banner: banner("home") });
await build({ ...common, entryPoints: ["src/pages/studio.mjs"], outfile: "site/js/studio.js", define, banner: banner("studio") });
await build({ ...common, entryPoints: ["src/pages/docs.mjs"], outfile: "site/js/docs.js", banner: banner("docs") });
await build({ ...common, entryPoints: ["src/pages/market.mjs"], outfile: "site/js/market.js", banner: banner("marketplace") });
await build({ ...common, entryPoints: ["src/pages/model.mjs"], outfile: "site/js/model.js", banner: banner("model") });
await build({ ...common, entryPoints: ["src/pages/site.mjs"], outfile: "site/js/site.js", banner: banner("site") });
await build({ ...common, entryPoints: ["src/three/car3d.mjs"], outfile: "site/js/car3d.js", globalName: "GL1FCar3D",
  banner: { js: banner("3D car").js + "\n/*! Bundles three.js r160: MIT License, Copyright 2010-2023 Three.js Authors. */" } });
execFileSync("python3", ["scripts/build_pages.py"], { stdio: "inherit" });
execFileSync("node", ["scripts/write_signals_list.mjs"], { stdio: "inherit" });
console.log("built site/js and site/*.html");
