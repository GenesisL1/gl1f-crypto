# Deploying GL1F Crypto

## Upgrade a live server (crypto.gl1f.com on nginx)

The website bundle, `gl1f-crypto-v1.13.0-website.zip`, holds `site/` (the website, with the protocol admin page),
`mcp/` (the MCP server for AI agents) and `deploy/` (the scripts). On the server:

```bash
cd ~ && unzip -oq gl1f-crypto-v1.13.0-website.zip && cd gl1f-crypto-v1.13.0
sudo bash deploy/upgrade.sh
```

It:

1. backs up the live site folder (the folder nginx serves) to `/var/backups/gl1f-crypto/`;
2. copies the new files over it (files only older releases had stay, unused);
3. installs or updates the MCP server: the `gl1f-mcp` service, on Deno, read-only, on `127.0.0.1:8787`;
4. runs `deploy/setup-crypto-nginx.sh` again, so nginx also serves `https://crypto.gl1f.com/mcp`. HTTPS, the
   certificate and the stagecrypto.gl1f.com redirect stay; nginx is backed up first and put back if anything fails;
5. checks that the site shows the new version and that `/mcp` answers.

Options: `SKIP_MCP=1` (the site only), `SKIP_NGINX=1` (leave nginx as it is), `SITE_DIR=...`, `DOMAIN=...`.

**Check afterwards**

- The footer says "GL1F Crypto v1.13.0".
- A model page shows "Answer Yes when the probability is from … to …" under Ask the model.
- The studio's backtest has "Upper P limit" and a number field for leverage.
- `/mcp` lists four tools:

```bash
curl -s https://crypto.gl1f.com/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

**Undo**

- The site: `sudo tar xzf /var/backups/gl1f-crypto/site-<time>.tar.gz -C /var/www` (the script prints the exact file).
- The MCP server: `sudo systemctl disable --now gl1f-mcp`, then `sudo MCP_PORT=off bash deploy/setup-crypto-nginx.sh`.

## First install on a new server

1. Copy the contents of `site/` to `/var/www/crypto.gl1f.com`.
2. `sudo REDIRECT_FROM=stagecrypto.gl1f.com EMAIL=you@example.com bash deploy/setup-crypto-nginx.sh` (HTTPS with a
   Let's Encrypt certificate; leave out REDIRECT_FROM without a staging name).
3. `sudo bash deploy/setup-mcp.sh`, then run the nginx script again to serve `/mcp`.

## Any static host

`site/` is plain HTML and JavaScript that reads GenesisL1 from the browser: it runs on any static host (GitHub Pages
publishes it from this repository). Only the MCP server needs a machine that runs a service.
