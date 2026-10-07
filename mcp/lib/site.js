// MIT License — Copyright (c) 2026 Decentralized Science Labs
// What the MCP server shares with the website, read from the deployed site folder (or its URL): the runtime config
// (contracts, RPC), the GL1F market engine (the exact file the site serves) and the Web3 API helper. So the server's
// answers match the model pages, and a new site release updates the server after a restart.

// The engine is the site's worker script; here it runs in the server's own process, with the hooks a worker would have.
export function loadEngine(code, { fetch: fetchImpl = globalThis.fetch, copyUrl = null } = {}) {
  const listeners = [], module = { exports: {} };
  const self = { addEventListener(type, fn) { if (type === "message") listeners.push(fn); }, postMessage() {} };
  new Function("module", "exports", "self", "postMessage", "fetch", code)(module, module.exports, self, () => {}, fetchImpl);
  const engine = module.exports;
  if (typeof engine.runInference !== "function") throw new Error("This file is not the GL1F market engine");
  // World signals: live public sources, with the site's own snapshot (data/world.json) as the fallback.
  for (const fn of listeners) fn({ data: { type: "env", worldUrl: null, copyUrl } });
  return { infer: (job) => engine.runInference(job), engine };
}

export async function loadSite({ dir = null, url = null, fetch: fetchImpl = globalThis.fetch } = {}) {
  const base = url ? (url.endsWith("/") ? url : `${url}/`) : null, folder = dir ? dir.replace(/\/+$/, "") : null;
  const useDir = folder !== null && await Deno.stat(`${folder}/runtime-config.js`).then(() => true, () => false);
  if (!useDir && !base) throw new Error(`No site at ${folder}: set GL1F_SITE_DIR to the site folder or GL1F_SITE_URL to its address`);
  const read = async (rel) => {
    if (useDir) return await Deno.readTextFile(`${folder}/${rel}`);
    const r = await fetchImpl(new URL(rel, base)); if (!r.ok) throw new Error(`${new URL(rel, base)}: HTTP ${r.status}`);
    return await r.text();
  };
  const scope = {};
  new Function("globalThis", await read("runtime-config.js"))(scope);
  const config = scope.GL1F_RUNTIME;
  if (!config?.contracts?.registry || !config?.contracts?.runtime) throw new Error("runtime-config.js has no contract addresses: is the site live?");
  const siteUrl = base || `${String(config.origin || "https://crypto.gl1f.com").replace(/\/+$/, "")}/`;
  const engine = loadEngine(await read("sdk/gl1f-engine.js"), { fetch: fetchImpl, copyUrl: new URL("data/world.json", siteUrl).href });
  const sdk = await import(useDir ? new URL(`file://${folder}/sdk/gl1f-crypto.js`).href : new URL("sdk/gl1f-crypto.js", base).href);
  if (typeof sdk.GL1FCrypto !== "function" || typeof sdk.questionText !== "function") throw new Error("sdk/gl1f-crypto.js is older than this MCP server: update the site to v1.13.0 or later");
  return { config, engine, GL1FCrypto: sdk.GL1FCrypto, questionText: sdk.questionText, siteUrl, source: useDir ? folder : base };
}
