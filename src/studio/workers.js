// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Workers are embedded as text at build time (scripts/build.mjs) and started from blob: URLs,
// so the studio runs the same on any static host and when opened straight from disk.
/* global __MARKET_WORKER__, __TRAIN_WORKER__ */
export function createWorker(name) {
  const source = name === "market" ? __MARKET_WORKER__ : __TRAIN_WORKER__;
  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  const worker = new Worker(url, { name: `gl1f-${name}` });
  // World signals read the public data published with the site (data/world.json).
  if (name === "market") {
    const canonical = document.querySelector('link[rel="canonical"]')?.href;
    worker.postMessage({ type: "env", worldUrl: new URL("./data/world.json", location.href).href, copyUrl: canonical ? new URL("./data/world.json", canonical).href : null });
  }
  return worker;
}
