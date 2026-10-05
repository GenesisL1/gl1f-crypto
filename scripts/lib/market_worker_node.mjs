// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Loads the classic-script market worker in Node with the world signals injected, as the build does for browsers.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as GL1F_WORLD from "../../src/studio/world_signals.js";
export function loadMarketWorker() {
  const context = { module: { exports: {} }, GL1F_WORLD, self: { postMessage() {} }, postMessage() {}, console, setTimeout, clearTimeout, URL, TextEncoder, TextDecoder, fetch: globalThis.fetch, AbortController, performance, crypto: globalThis.crypto };
  vm.runInNewContext(readFileSync(new URL("../../src/studio/market_worker.js", import.meta.url), "utf8"), context);
  return context.module.exports;
}
