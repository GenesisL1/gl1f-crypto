// MIT License — Copyright (c) 2026 Decentralized Science Labs
// GL1F Crypto MCP server: Crypto AI models as tools for AI agents (list_models, get_model, ask_model, trading_rules).
// Ask a model with a Yes range: ask_model { model, threshold, threshold_max } (defaults 0.5 and 1).
//   deno run --allow-net --allow-env --allow-read mcp.js --stdio                          (local agents)
//   deno run --allow-net --allow-env --allow-read mcp.js --http=127.0.0.1:8787            (behind nginx at /mcp)
//   GL1F_SITE_DIR   the deployed site folder (default /var/www/crypto.gl1f.com), else GL1F_SITE_URL (https://crypto.gl1f.com/)
//   GL1F_RPC_URL    a GenesisL1 RPC other than the site's
import { ethers } from "ethers";
import { loadSite } from "./lib/site.js";
import { createModels } from "./lib/models.js";
import { createMcp } from "./lib/mcp.js";
import { httpHandler, serveStdio } from "./lib/mcp_transport.js";

const env = (k, d = null) => Deno.env.get(k) || d;
const httpArg = Deno.args.find((a) => a.startsWith("--http")), log = { warn: (...a) => console.error(...a), error: (...a) => console.error(...a) };
const site = await loadSite({ dir: env("GL1F_SITE_DIR", "/var/www/crypto.gl1f.com"), url: env("GL1F_SITE_URL", "https://crypto.gl1f.com/") })
  .catch((e) => { console.error(`Site: ${e.message}`); Deno.exit(1); });
const c = site.config;
const sdk = new site.GL1FCrypto({ ethers, rpcUrl: env("GL1F_RPC_URL", c.network.rpcUrl), chainId: c.network.chainId, registry: c.contracts.registry, runtime: c.contracts.runtime, nft: c.contracts.nft });
const models = createModels({ sdk, engine: site.engine, questionText: site.questionText, siteUrl: site.siteUrl });
const mcp = createMcp({ models, log });

if (httpArg) {
  const [host, port] = (httpArg.split("=")[1] || "127.0.0.1:8787").split(":");
  Deno.serve({ hostname: host || "127.0.0.1", port: Number(port || 8787), onListen: ({ hostname, port }) => console.error(`GL1F Crypto MCP server on http://${hostname}:${port}/mcp · site ${site.source}`) }, httpHandler(mcp));
} else {
  console.error(`GL1F Crypto MCP server on stdio · site ${site.source}`);
  await serveStdio(mcp);
}
