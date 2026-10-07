# GL1F Crypto MCP server

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets AI assistants and agents use Crypto AI
models on GenesisL1 without code. Read-only: no keys, no wallet, no login.

Live at **`https://crypto.gl1f.com/mcp`** (Streamable HTTP).

| Tool | Arguments | What it returns |
|------|-----------|-----------------|
| `list_models` | `limit?`, `before?` | Published models, newest first: number, title, question, market and candle, access, page |
| `get_model` | `model` (number or link) | One model's details, with the trading rules its backtest uses |
| `ask_model` | `model`, `threshold?`, `threshold_max?` | The answer for the latest completed candle: yes or no, the probability, the Yes range used, the candle, the page |
| `trading_rules` | `model`, `threshold?`, `threshold_max?` | The backtest's rules: direction, signal range, entry, target and stop from the EMA baseline, time limit |

The answer is **yes when threshold <= probability <= threshold_max** (defaults 0.5 and 1: yes at 50% or more), the
same rule as the website's model pages, studio and Web3 API. Every tool declares the shape of its result
(`outputSchema`).

## Connect

- **Claude** (web, desktop, mobile): add a custom connector with `https://crypto.gl1f.com/mcp`.
- **ChatGPT**: turn on developer mode, then add a connector (app) with the address and no authentication.
- **Claude Code**: `claude mcp add --transport http gl1f-crypto https://crypto.gl1f.com/mcp`
- **Local agents over stdio** (Codex, Claude Desktop config, ...): `deno task stdio` in this folder, with
  `GL1F_SITE_URL=https://crypto.gl1f.com/` or `GL1F_SITE_DIR=<a site folder>`.

## How it works

It loads the deployed site's own files (`runtime-config.js` for the contracts and RPC, `sdk/gl1f-engine.js`, the market
engine, and `sdk/gl1f-crypto.js`, the Web3 API), so its answers match the model pages and a new site release updates
it after a restart. For `ask_model` it computes the model's inputs from public exchange data and runs the model on
GenesisL1 once per candle, shared by everyone who asks; each caller's Yes range is applied to that shared probability.
Paid models are refused. Each client may send 120 requests a minute; requests are limited to 64 KB.

Runtime: [Deno](https://deno.com) 2 (no Node.js), with ethers as its only dependency, locked in `deno.lock`.

## Run

```bash
deno task stdio                                    # stdio, for a local agent
deno task http                                     # http://127.0.0.1:8787/mcp
deno task test                                     # tests, including the official MCP TypeScript client
```

On a server, `sudo bash deploy/setup-mcp.sh` installs it as the `gl1f-mcp` service (pinned Deno checked against its
SHA-256, its own user with no login, read-only on the site), and `deploy/setup-crypto-nginx.sh` serves it at
`https://<site>/mcp`. Environment: `GL1F_SITE_DIR` (default `/var/www/crypto.gl1f.com`), `GL1F_SITE_URL`,
`GL1F_RPC_URL`.

Educational, experimental software, not investment advice. MIT License.
