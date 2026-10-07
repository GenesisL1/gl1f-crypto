#!/usr/bin/env bash
# =============================================================================
# upgrade.sh
# Puts this GL1F Crypto release on a server that already runs the site (crypto.gl1f.com on nginx), in one command:
#   1. backs up the live site folder (/var/backups/gl1f-crypto/site-<time>.tar.gz)
#   2. copies the release's site files over it (files only older releases had stay where they are, unused)
#   3. installs or updates the MCP server for AI agents (deploy/setup-mcp.sh, service gl1f-mcp)
#   4. runs deploy/setup-crypto-nginx.sh again, so nginx also serves https://<site>/mcp. It keeps HTTPS, the
#      certificate and the staging redirect, backs nginx up first and puts it back if anything fails.
#   5. checks that the site shows the new version and that /mcp answers
#
# Usage (from the unzipped release):   sudo bash deploy/upgrade.sh
# Options: SITE_DIR=/var/www/crypto.gl1f.com   DOMAIN=crypto.gl1f.com
#          SKIP_MCP=1 (the site only)   SKIP_NGINX=1 (leave nginx as it is; /mcp is then not served)
# Undo the site part: sudo tar xzf /var/backups/gl1f-crypto/site-<time>.tar.gz -C <parent of SITE_DIR>
# =============================================================================
set -Eeuo pipefail

DOMAIN="${DOMAIN:-crypto.gl1f.com}"
# The folder nginx serves for DOMAIN (its "root" line), so the files land where the live site really is.
LIVE_ROOT="$(grep -hE '^[[:space:]]*root[[:space:]]' "/etc/nginx/sites-available/$DOMAIN" 2>/dev/null | grep -v _letsencrypt | head -n1 | sed -E 's/^[[:space:]]*root[[:space:]]+([^;]+);.*/\1/' || true)"
SITE_DIR="${SITE_DIR:-${LIVE_ROOT:-/var/www/$DOMAIN}}"
SKIP_MCP="${SKIP_MCP:-0}" SKIP_NGINX="${SKIP_NGINX:-0}"
log()  { printf '\033[1;32m[+]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }
trap 'die "Unexpected error on line $LINENO."' ERR

[[ $EUID -eq 0 ]] || die "Run as root:  sudo bash $0"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; ROOT="$(cd "$HERE/.." && pwd)"
[[ -f "$ROOT/site/index.html" && -f "$ROOT/site/runtime-config.js" ]] || die "No site/ folder next to deploy/: run this from the unzipped release."
[[ -d "$SITE_DIR" && -f "$SITE_DIR/index.html" ]] || die "No site in $SITE_DIR. For a first install use deploy/setup-crypto-nginx.sh (see DEPLOY.md), or set SITE_DIR=..."
NEW="$(grep -o 'GL1F Crypto v[0-9][0-9.]*' "$ROOT/site/index.html" | head -n1 | sed 's/GL1F Crypto v//')"
OLD="$(grep -o 'GL1F Crypto v[0-9][0-9.]*' "$SITE_DIR/index.html" | head -n1 | sed 's/GL1F Crypto v//' || true)"
log "Site $SITE_DIR: v${OLD:-?} → v$NEW"

# 1. Backup
mkdir -p /var/backups/gl1f-crypto; chmod 700 /var/backups/gl1f-crypto
BACKUP="/var/backups/gl1f-crypto/site-$(date +%Y%m%d-%H%M%S).tar.gz"
tar czf "$BACKUP" -C "$(dirname "$SITE_DIR")" "$(basename "$SITE_DIR")"
log "Backup: $BACKUP"

# 2. The new files, owned like the folder, readable by the web server
OWNER="$(stat -c %U "$SITE_DIR")" GROUP="$(stat -c %G "$SITE_DIR")"
cp -R "$ROOT/site/." "$SITE_DIR/"
(cd "$ROOT/site" && find . -mindepth 1 -print0) | (cd "$SITE_DIR" && xargs -0 chown "$OWNER:$GROUP")
(cd "$ROOT/site" && find . -mindepth 1 -type d -print0) | (cd "$SITE_DIR" && xargs -0 chmod 755)
(cd "$ROOT/site" && find . -mindepth 1 -type f -print0) | (cd "$SITE_DIR" && xargs -0 chmod 644)
log "Site files copied ($(cd "$ROOT/site" && find . -type f | wc -l) files)"

# 3. MCP server
if [[ "$SKIP_MCP" != 1 ]]; then SITE_DIR="$SITE_DIR" bash "$HERE/setup-mcp.sh"; else warn "SKIP_MCP=1: the MCP server was not installed or updated."; fi

# 4. nginx: serves /mcp next to the site (re-run of the site's own setup; keeps HTTPS and the redirect)
if [[ "$SKIP_NGINX" != 1 ]]; then DOMAIN="$DOMAIN" PROJECT_DIR="$SITE_DIR" WEB_ROOT="$SITE_DIR" bash "$HERE/setup-crypto-nginx.sh"; else warn "SKIP_NGINX=1: nginx left as it is."; fi

# 5. Checks
sleep 1
if curl -fsS -m 15 "https://$DOMAIN/" 2>/dev/null | grep -q "GL1F Crypto v$NEW"; then log "https://$DOMAIN/ shows v$NEW"
else warn "https://$DOMAIN/ does not show v$NEW yet (a CDN or browser cache can lag; check the footer)."; fi
if [[ "$SKIP_MCP" != 1 && "$SKIP_NGINX" != 1 ]]; then
  if curl -fsS -m 30 "https://$DOMAIN/mcp" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
       -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' 2>/dev/null | grep -q '"ask_model"'; then log "https://$DOMAIN/mcp answers (4 tools)"
  else warn "https://$DOMAIN/mcp did not answer: journalctl -u gl1f-mcp -n 30"; fi
fi
cat <<DONE

==============================================================
 GL1F Crypto v$NEW is live on https://$DOMAIN/
--------------------------------------------------------------
 MCP server for AI agents: https://$DOMAIN/mcp
   Claude: + > Connectors > Add custom connector > paste the URL
   Claude Code: claude mcp add --transport http gl1f-crypto https://$DOMAIN/mcp
 Site backup: $BACKUP
==============================================================
DONE
