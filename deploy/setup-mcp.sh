#!/usr/bin/env bash
# =============================================================================
# setup-mcp.sh
# The GL1F Crypto MCP server for AI agents (Claude, ChatGPT, Claude Code, Codex...), next to the site, on Deno (no
# Node.js). It runs as the systemd service gl1f-mcp on 127.0.0.1:8787; setup-crypto-nginx.sh then serves it at
# https://<site>/mcp. Read-only: no keys, no wallet. It reads the deployed site's own files (contracts, the market
# engine and the Web3 API), so its answers match the model pages.
#
# Safe for the rest of the server: only its own files (/opt/gl1f-mcp, /opt/deno, /var/lib/gl1f-mcp and its systemd
# unit); one system user with no login, read-only on the site; Deno pinned and checked against its SHA-256.
# Re-running is safe: it updates the code and restarts the service.
#
# Usage:   sudo bash deploy/setup-mcp.sh
# Options: SITE_DIR=/var/www/crypto.gl1f.com   MCP_PORT=8787   DENO_VERSION=2.9.7
# =============================================================================
set -Eeuo pipefail

SITE_DIR="${SITE_DIR:-/var/www/crypto.gl1f.com}"
DENO_VERSION="${DENO_VERSION:-2.9.7}"
MCP_PORT="${MCP_PORT:-8787}"
APP=/opt/gl1f-mcp DENO_HOME=/opt/deno DATA=/var/lib/gl1f-mcp MCP_USER=gl1fmcp UNIT=/etc/systemd/system/gl1f-mcp.service

log()  { printf '\033[1;32m[+]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }
trap 'die "Unexpected error on line $LINENO."' ERR

[[ $EUID -eq 0 ]] || die "Run as root:  sudo bash $0"
command -v systemctl >/dev/null || die "systemd is required."
command -v curl >/dev/null || die "curl is required (apt install curl)."
[[ "$MCP_PORT" =~ ^[0-9]+$ ]] || die "MCP_PORT must be a port number."

# The code: the mcp/ folder next to this script's folder (the release bundle or the repository).
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$HERE/../mcp/mcp.js" && -d "$HERE/../mcp/lib" ]]; then SRC="$(cd "$HERE/../mcp" && pwd)"
elif [[ -f "$HERE/mcp.js" && -d "$HERE/lib" ]]; then SRC="$HERE"
else die "The MCP server's files (mcp/mcp.js, mcp/lib/) are not next to this script."; fi

[[ -f "$SITE_DIR/runtime-config.js" && -f "$SITE_DIR/sdk/gl1f-engine.js" && -f "$SITE_DIR/sdk/gl1f-crypto.js" ]] || die "No GL1F Crypto site in $SITE_DIR. Set SITE_DIR=..."
grep -q "thresholdMax" "$SITE_DIR/sdk/gl1f-crypto.js" || die "The site in $SITE_DIR is older than this MCP server: deploy site v1.13.0 or later first."
SITE_GROUP="$(stat -c %G "$SITE_DIR")"
log "Site: $SITE_DIR · MCP server on 127.0.0.1:$MCP_PORT"

# Deno: one binary, pinned, verified against the release's SHA-256.
case "$(uname -m)" in x86_64) TARGET=x86_64-unknown-linux-gnu ;; aarch64|arm64) TARGET=aarch64-unknown-linux-gnu ;; *) die "Unsupported CPU $(uname -m)." ;; esac
if [[ "$("$DENO_HOME/bin/deno" --version 2>/dev/null | head -n1 | awk '{print $2}')" != "$DENO_VERSION" ]]; then
  log "Installing Deno $DENO_VERSION in $DENO_HOME"
  TMP="$(mktemp -d)"; ZIP="deno-$TARGET.zip"; URL="https://github.com/denoland/deno/releases/download/v$DENO_VERSION/$ZIP"
  curl -fsSL -o "$TMP/$ZIP" "$URL"; curl -fsSL -o "$TMP/$ZIP.sha256sum" "$URL.sha256sum"
  (cd "$TMP" && sha256sum -c --quiet "$ZIP.sha256sum") || die "Deno download failed its SHA-256 check."
  mkdir -p "$DENO_HOME/bin"
  if command -v unzip >/dev/null; then unzip -oq "$TMP/$ZIP" -d "$DENO_HOME/bin"
  else python3 -c "import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$TMP/$ZIP" "$DENO_HOME/bin"; fi
  chmod 755 "$DENO_HOME/bin/deno"; rm -rf "$TMP"
fi
DENO="$DENO_HOME/bin/deno"
log "Deno: $("$DENO" --version | head -n1)"

id "$MCP_USER" >/dev/null 2>&1 || useradd --system --home-dir "$DATA" --no-create-home --shell /usr/sbin/nologin "$MCP_USER"
install -d -m 750 -o "$MCP_USER" -g "$MCP_USER" "$DATA" "$DATA/deno"

rm -rf "$APP.new"; mkdir -p "$APP.new"
for f in mcp.js deno.json deno.lock lib README.md; do [[ -e "$SRC/$f" ]] && cp -r "$SRC/$f" "$APP.new/"; done
chown -R root:root "$APP.new"; chmod -R u=rwX,go=rX "$APP.new"
rm -rf "$APP"; mv "$APP.new" "$APP"
log "Code: $APP · fetching its one dependency (ethers, frozen to deno.lock)..."
(cd "$APP" && runuser -u "$MCP_USER" -- env -i HOME="$DATA" DENO_DIR="$DATA/deno" PATH=/usr/bin:/bin "$DENO" cache --frozen mcp.js >/dev/null)

cat > "$UNIT" <<UNIT
[Unit]
Description=GL1F Crypto MCP server for AI agents
After=network-online.target
Wants=network-online.target

[Service]
User=$MCP_USER
Group=$MCP_USER
SupplementaryGroups=$SITE_GROUP
Environment=DENO_DIR=$DATA/deno HOME=$DATA GL1F_SITE_DIR=$SITE_DIR
WorkingDirectory=$APP
ExecStart=$DENO run --cached-only --frozen --no-prompt --allow-net --allow-env --allow-read=$APP,$SITE_DIR $APP/mcp.js --http=127.0.0.1:$MCP_PORT
Restart=always
RestartSec=15
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DATA

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable gl1f-mcp >/dev/null 2>&1
systemctl restart gl1f-mcp

# It answers once the site's engine and Web3 API are loaded (a few seconds).
OK=0
for _ in $(seq 1 20); do
  if curl -fsS -m 5 "http://127.0.0.1:$MCP_PORT/mcp" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
       -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' 2>/dev/null | grep -q '"ask_model"'; then OK=1; break; fi
  sleep 2
done
if [[ "$OK" == 1 ]]; then log "gl1f-mcp is running: 4 tools (list_models, get_model, ask_model, trading_rules)"
else warn "gl1f-mcp did not answer yet. Its log:"; journalctl -u gl1f-mcp -n 15 --no-pager -o cat 2>/dev/null | sed 's/^/    /' || true; exit 1; fi

cat <<DONE

==============================================================
 GL1F Crypto MCP server (gl1f-mcp) on 127.0.0.1:$MCP_PORT
--------------------------------------------------------------
 Serve it at https://<site>/mcp: run deploy/setup-crypto-nginx.sh again
 (deploy/upgrade.sh does both). Logs: journalctl -u gl1f-mcp -f
 After a new site release: sudo systemctl restart gl1f-mcp
==============================================================
DONE
