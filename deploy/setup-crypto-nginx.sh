#!/usr/bin/env bash
# =============================================================================
# setup-crypto-nginx.sh
# GL1F Crypto on nginx with Let's Encrypt HTTPS: crypto.gl1f.com (production) and, optionally, a permanent
# redirect from the staging domain. GL1F Crypto is a static site (HTML + JS that reads GenesisL1 from the browser):
# nothing runs on the server but nginx.
#
# Put the site folder at /var/www/crypto.gl1f.com (its index.html directly there, or in a site/ subfolder).
#
# Safe for the other sites on this server:
#   - only creates/edits this domain's own vhost file and /etc/cron.d/gl1f-crypto, never touches others
#   - aborts if another vhost already claims one of these names
#   - backs up /etc/nginx first; runs `nginx -t` before every reload and
#     auto-rolls back this domain's file if the test fails
#   - uses `reload` (zero downtime), never `restart`
#   - uses `certbot certonly --webroot` (certbot never edits nginx configs)
#   - no default_server, its own SSL session-cache zone, and http2 handled
#     so older nginx doesn't flip http2 on for every site on :443
#
# Usage:   sudo bash deploy/setup-crypto-nginx.sh
#          sudo REDIRECT_FROM=stagecrypto.gl1f.com EMAIL=me@x.com bash deploy/setup-crypto-nginx.sh
# Re-running is safe (idempotent): it re-applies config and permissions.
#
# Optional overrides (env vars):
#   EMAIL=you@example.com          Let's Encrypt expiry notices
#   REDIRECT_FROM=stagecrypto.gl1f.com   also answer this name, with a 301 to the same path on DOMAIN
#                                  (re-runs keep the one already set up; REDIRECT_FROM=none removes it)
#   PROJECT_DIR=/var/www/...       where the site is (default /var/www/$DOMAIN)
#   WEB_ROOT=/var/www/.../site     folder holding index.html (auto-detected)
#   NOINDEX=1                      block search engines (default 0: this is production)
#   DEPLOY_USER=alice              owner of the site files (default: the folder's current owner)
#   MCP_PORT=8787                  serve the GL1F Crypto MCP server at https://$DOMAIN/mcp (automatic when the gl1f-mcp
#                                  service is installed; MCP_PORT=off leaves it out)
#   PRINT_CONFIG=1                 print the HTTPS vhost this would install, then exit (changes nothing)
# =============================================================================
set -Eeuo pipefail

DOMAIN="${DOMAIN:-crypto.gl1f.com}"
REDIRECT_FROM="${REDIRECT_FROM:-}"
PROJECT_DIR="${PROJECT_DIR:-/var/www/$DOMAIN}"
EMAIL="${EMAIL:-}"
NOINDEX="${NOINDEX:-0}"
DEPLOY_USER="${DEPLOY_USER:-}"
WEB_ROOT="${WEB_ROOT:-}"
PRINT_CONFIG="${PRINT_CONFIG:-0}"
MCP_PORT="${MCP_PORT:-}"
if [[ -z "$MCP_PORT" && -f /etc/systemd/system/gl1f-mcp.service ]]; then
  MCP_PORT="$(sed -n 's/.*--http=127\.0\.0\.1:\([0-9]*\).*/\1/p' /etc/systemd/system/gl1f-mcp.service | head -n1)"; MCP_PORT="${MCP_PORT:-8787}"
fi
if [[ "$MCP_PORT" == "off" ]]; then MCP_PORT=""; fi

NGINX_DIR=/etc/nginx
ACME_ROOT=/var/www/_letsencrypt
LE_LIVE="/etc/letsencrypt/live/$DOMAIN"
OLD_CRON_FILE=/etc/cron.d/gl1f-crypto   # the refresh job of earlier versions; removed if present
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="/root/nginx-backup-$TS.tar.gz"
TMP_CONF="$(mktemp)"
PREV_CONF=""
CONF_FILE=""
LINK_FILE=""
CONFIG_TOUCHED=0
# Re-running keeps an existing staging redirect: without REDIRECT_FROM, the name this script wrote last time is reused
# (REDIRECT_FROM=none drops it).
REDIRECT_KEPT=0
if [[ -z "$REDIRECT_FROM" ]]; then
  REDIRECT_FROM="$(grep -rhoE "^# [A-Za-z0-9.-]+ moved: the same path on ${DOMAIN//./\\.}," /etc/nginx/sites-available /etc/nginx/conf.d 2>/dev/null | head -n1 | sed -E 's/^# ([^ ]+) moved:.*/\1/' || true)"
  [[ -n "$REDIRECT_FROM" ]] && REDIRECT_KEPT=1
fi
if [[ "$REDIRECT_FROM" == "none" ]]; then REDIRECT_FROM=""; fi
NAMES="$DOMAIN${REDIRECT_FROM:+ $REDIRECT_FROM}"
ZONE="$(printf '%s' "$DOMAIN" | tr -c 'a-zA-Z0-9' '_')_tls"

log()  { printf '\033[1;32m[+]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; }
die()  { err "$*"; exit 1; }
[[ "$REDIRECT_KEPT" == 1 ]] && log "keeping the redirect from $REDIRECT_FROM (found in the current nginx config)"

reload_nginx() {
  if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet nginx; then
    systemctl reload nginx
  else
    nginx -s reload
  fi
}

rollback() {
  if [[ $CONFIG_TOUCHED -ne 1 ]]; then return 0; fi
  warn "Rolling back $DOMAIN config (other sites were never modified)..."
  if [[ -n "$PREV_CONF" ]]; then
    cp -a "$PREV_CONF" "$CONF_FILE"
  else
    rm -f "$CONF_FILE"
    if [[ -n "$LINK_FILE" ]]; then rm -f "$LINK_FILE"; fi
  fi
  CONFIG_TOUCHED=0
  if nginx -t >/dev/null 2>&1; then reload_nginx || true; fi
}

on_error() {
  local rc=$? line=$1
  err "Unexpected error on line $line (exit $rc)."
  rollback
  if [[ -f "$BACKUP" ]]; then err "Pre-change backup of /etc/nginx: $BACKUP"; fi
  exit "$rc"
}
trap 'on_error $LINENO' ERR
trap 'rm -f "$TMP_CONF" "${PREV_CONF:-}"' EXIT

apply_conf() {
  install -m 644 -o root -g root "$TMP_CONF" "$CONF_FILE"
  if [[ -n "$LINK_FILE" ]]; then ln -sfn "$CONF_FILE" "$LINK_FILE"; fi
  CONFIG_TOUCHED=1
  if ! nginx -t 2>&1 | sed 's/^/    /'; then
    rollback
    die "New config failed 'nginx -t' and was rolled back. Other sites untouched."
  fi
  reload_nginx
  log "nginx reloaded (graceful, no downtime)."
}


# ----------------------------------------------------------------------------
# 0. Preflight
# ----------------------------------------------------------------------------
if [[ "$PRINT_CONFIG" != "1" ]]; then [[ $EUID -eq 0 ]] || die "Run as root:  sudo bash $0"; fi
command -v nginx >/dev/null || die "nginx is not installed."
command -v curl  >/dev/null || die "curl is required (apt install curl)."
[[ -d "$PROJECT_DIR" ]]     || die "Directory $PROJECT_DIR not found. Copy the GL1F Crypto site there first."

if [[ "$PRINT_CONFIG" != "1" ]]; then
  log "Checking the CURRENT nginx config is valid before changing anything..."
  if ! nginx -t >/dev/null 2>&1; then
    nginx -t || true
    die "Existing nginx config already fails 'nginx -t'. Fix that first; nothing was changed."
  fi
fi
NGX_DUMP="$(nginx -T 2>/dev/null || true)"

# Where vhosts live on this server
if grep -Eq '^[[:space:]]*include[[:space:]]+[^;]*sites-enabled' "$NGINX_DIR/nginx.conf"; then
  CONF_FILE="$NGINX_DIR/sites-available/$DOMAIN"
  LINK_FILE="$NGINX_DIR/sites-enabled/$DOMAIN"
elif grep -Eq '^[[:space:]]*include[[:space:]]+[^;]*conf\.d' "$NGINX_DIR/nginx.conf"; then
  CONF_FILE="$NGINX_DIR/conf.d/$DOMAIN.conf"
else
  die "nginx.conf includes neither sites-enabled nor conf.d; not sure where to put the vhost."
fi

# Refuse if some OTHER vhost already serves one of these names
for name in $NAMES; do
  DUPES="$(awk -v d="$name" -v a="$CONF_FILE" -v b="$LINK_FILE" '
    /^# configuration file /{ f=$4; sub(/:$/,"",f); next }
    $1=="server_name" { for(i=2;i<=NF;i++){ n=$i; sub(/;$/,"",n); if(n==d && f!=a && f!=b) print f } }
  ' <<<"$NGX_DUMP" | sort -u)"
  if [[ -n "$DUPES" ]]; then
    if [[ "$name" == "$REDIRECT_FROM" ]]; then
      die "$name is still served by: $DUPES. Disable that vhost first (for example: sudo rm /etc/nginx/sites-enabled/$name && sudo nginx -t && sudo systemctl reload nginx), then re-run. Nothing changed."
    fi
    die "$name is already defined in: $DUPES — remove/rename it there first (nothing changed)."
  fi
done

# nginx worker user/group
NGINX_USER="$(awk '$1=="user"{ sub(/;$/,"",$2); print $2; exit }' "$NGINX_DIR/nginx.conf")"
if [[ -z "$NGINX_USER" ]]; then
  NGINX_USER="$(ps -o user= -C nginx 2>/dev/null | grep -vx root | head -n1 || true)"
fi
NGINX_USER="${NGINX_USER:-www-data}"
id "$NGINX_USER" >/dev/null 2>&1 || die "Cannot determine nginx worker user."
NGINX_GROUP="$(id -gn "$NGINX_USER")"

# Folder that actually holds index.html: the bundle's site/ first
if [[ -z "$WEB_ROOT" ]]; then
  for d in site . dist build public out www; do
    if [[ -f "$PROJECT_DIR/$d/index.html" ]]; then WEB_ROOT="$(cd "$PROJECT_DIR/$d" && pwd)"; break; fi
  done
fi
[[ -n "$WEB_ROOT" ]] || die "No index.html in $PROJECT_DIR (or its site/ folder). Copy the GL1F Crypto site there first."
if [[ "$WEB_ROOT" == "$(cd "$PROJECT_DIR" && pwd)" && -d "$PROJECT_DIR/scripts" ]]; then
  warn "Serving the project folder itself would expose its scripts; set WEB_ROOT to its site/ folder."
fi

# http2 / ipv6 handling that can't affect other vhosts
NGX_VER="$(nginx -v 2>&1 | sed -nE 's|.*nginx/([0-9]+\.[0-9]+\.[0-9]+).*|\1|p')"
ver_ge() { [[ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1)" == "$2" ]]; }
HTTP2_LINE=""
if [[ -n "$NGX_VER" ]] && ver_ge "$NGX_VER" 1.25.1; then
  LISTEN_443="listen 443 ssl;"
  HTTP2_LINE="    http2 on;"
elif grep -Eq '^[[:space:]]*listen[[:space:]][^;]*443[^;]*http2' <<<"$NGX_DUMP"; then
  LISTEN_443="listen 443 ssl http2;"          # already on for :443, match it
else
  LISTEN_443="listen 443 ssl;"                # old nginx: enabling http2 here would change all :443 sites
fi
V6_80=""; V6_443=""
if [[ -s /proc/net/if_inet6 ]] && ! grep -q 'ipv6only=off' <<<"$NGX_DUMP"; then
  V6_80="    listen [::]:80;"
  V6_443="    ${LISTEN_443/443/[::]:443}"
fi

# Security headers. nginx drops server-level add_header in any location that has its own, so the one location
# that adds a header (/sdk/) repeats them.
SEC_HEADERS='    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options    "nosniff" always;
    add_header X-Frame-Options           "SAMEORIGIN" always;
    add_header Referrer-Policy           "strict-origin-when-cross-origin" always;'
if [[ "$NOINDEX" == "1" ]]; then SEC_HEADERS+=$'\n    add_header X-Robots-Tag              "noindex, nofollow" always;'; fi
SEC_HEADERS_IN_LOCATION="${SEC_HEADERS//    add_header/        add_header}"
# GL1F Crypto has a real 404 page: it also opens models published since the last build (/m/<id>/).
ERROR_PAGE_LINE=""
if [[ -f "$WEB_ROOT/404.html" ]]; then ERROR_PAGE_LINE="    error_page 404 /404.html;"; fi

# The MCP server for AI agents (the gl1f-mcp service on this machine), at /mcp. X-Forwarded-For is set here, not passed
# through, so a client cannot dodge the server's rate limit with a made-up address.
MCP_BLOCK=""
if [[ -n "$MCP_PORT" ]]; then
  [[ "$MCP_PORT" =~ ^[0-9]+$ ]] || die "MCP_PORT must be a port number (or off)."
  MCP_BLOCK="    # GL1F Crypto MCP server for AI agents (gl1f-mcp)
    location = /mcp {
        proxy_pass http://127.0.0.1:${MCP_PORT}/mcp;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_read_timeout 120s;
        client_max_body_size 64k;
    }
"
fi

# ----------------------------------------------------------------------------
# Config templates
# ----------------------------------------------------------------------------
write_http_conf() {
cat > "$TMP_CONF" <<EOF
# ${DOMAIN} — managed by setup-crypto-nginx.sh (temporary, pre-certificate)
server {
    listen 80;
${V6_80}
    server_name ${NAMES};

    location ^~ /.well-known/acme-challenge/ {
        root ${ACME_ROOT};
        default_type "text/plain";
        try_files \$uri =404;
    }
    location / { return 404; }
}
EOF
}

write_https_conf() {
cat > "$TMP_CONF" <<EOF
# ${DOMAIN} — managed by setup-crypto-nginx.sh (${TS})
# GL1F Crypto from ${WEB_ROOT}; TLS via Let's Encrypt (certonly --webroot, auto-renews)

server {
    listen 80;
${V6_80}
    server_name ${NAMES};

    # Let's Encrypt renewals stay on plain HTTP
    location ^~ /.well-known/acme-challenge/ {
        root ${ACME_ROOT};
        default_type "text/plain";
        try_files \$uri =404;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    ${LISTEN_443}
${V6_443}
${HTTP2_LINE}
    server_name ${DOMAIN};

    ssl_certificate     ${LE_LIVE}/fullchain.pem;
    ssl_certificate_key ${LE_LIVE}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_session_timeout 1d;
    ssl_session_cache   shared:${ZONE}:10m;
    ssl_session_tickets off;

    root  ${WEB_ROOT};
    index index.html;
    charset utf-8;

    access_log /var/log/nginx/${DOMAIN}.access.log;
    error_log  /var/log/nginx/${DOMAIN}.error.log warn;

${SEC_HEADERS}

    gzip on;
    gzip_vary on;
    gzip_comp_level 5;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/javascript application/javascript application/json application/wasm image/svg+xml application/xml text/markdown application/manifest+json;

${ERROR_PAGE_LINE}

${MCP_BLOCK}
    # Never serve dotfiles (.git, .env, ...) or node_modules
    location ~ /\.(?!well-known/) { return 404; }
    location ^~ /node_modules/    { return 404; }

    # Pages and data change with every build and refresh: always revalidated, so releases show at once
    location ~* \.(?:html|json|xml|txt)\$ {
        expires -1;
        try_files \$uri =404;
    }
    # Markdown copies of the pages (for language models)
    location ~* \.md\$ {
        types { }
        default_type "text/markdown; charset=utf-8";
        expires -1;
        try_files \$uri =404;
    }
    location ~* \.webmanifest\$ {
        types { }
        default_type application/manifest+json;
        expires 1d;
        try_files \$uri =404;
    }
    # The Web3 API files are loaded by URL from other sites and scripts: an hour, cross-origin
    location ^~ /sdk/ {
        expires 1h;
        add_header Access-Control-Allow-Origin "*" always;
${SEC_HEADERS_IN_LOCATION}
        try_files \$uri =404;
    }
    # WebAssembly / ES modules with correct MIME types (older mime.types lack them)
    location ~* \.(?:wasm|mjs)\$ {
        types { application/wasm wasm; text/javascript mjs; }
        try_files \$uri =404;
        expires 1h;
    }
    # Scripts, styles and fonts are versioned (?v=release): a year
    location ~* \.(?:js|css|woff2?|ttf|otf)\$ {
        expires 1y;
        access_log off;
        try_files \$uri =404;
    }
    # Images and model preview cards: a day
    location ~* \.(?:png|jpe?g|gif|webp|avif|svg|ico)\$ {
        expires 1d;
        access_log off;
        try_files \$uri =404;
    }

    location / {
        try_files \$uri \$uri/ =404;
    }
}
EOF
if [[ -n "$REDIRECT_FROM" ]]; then
cat >> "$TMP_CONF" <<EOF

# ${REDIRECT_FROM} moved: the same path on ${DOMAIN}, permanently (model pages and shared links keep working)
server {
    ${LISTEN_443}
${V6_443}
${HTTP2_LINE}
    server_name ${REDIRECT_FROM};

    ssl_certificate     ${LE_LIVE}/fullchain.pem;
    ssl_certificate_key ${LE_LIVE}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_session_cache   shared:${ZONE}:10m;

    return 301 https://${DOMAIN}\$request_uri;
}
EOF
fi
}

if [[ "$PRINT_CONFIG" == "1" ]]; then write_https_conf; cat "$TMP_CONF"; exit 0; fi

log "Vhost file: $CONF_FILE${LINK_FILE:+ (enabled via $LINK_FILE)}"
log "nginx runs as $NGINX_USER:$NGINX_GROUP"
log "Web root: $WEB_ROOT"
if [[ -n "$LINK_FILE" ]]; then mkdir -p "$NGINX_DIR/sites-available" "$NGINX_DIR/sites-enabled"; fi
if [[ -f "$CONF_FILE" ]]; then
  PREV_CONF="$(mktemp)"
  cp -a "$CONF_FILE" "$PREV_CONF"
  log "Existing $CONF_FILE found; it will be updated (old copy kept for rollback)."
fi

# ----------------------------------------------------------------------------
# 1. Backup
# ----------------------------------------------------------------------------
log "Backing up /etc/nginx -> $BACKUP"
tar -czf "$BACKUP" -C / etc/nginx

# ----------------------------------------------------------------------------
# 2. Owner and permissions (project dir only)
# ----------------------------------------------------------------------------
OWNER="${DEPLOY_USER:-$(stat -c %U "$PROJECT_DIR")}"
id "$OWNER" >/dev/null 2>&1 || die "Deploy user '$OWNER' does not exist."
log "Permissions: owner=$OWNER, group=$NGINX_GROUP, dirs 2750, files 640 (existing executables keep +x)"
chown -R "$OWNER:$NGINX_GROUP" "$PROJECT_DIR"
chmod -R u=rwX,g=rX,o= "$PROJECT_DIR"
find "$PROJECT_DIR" -type d -exec chmod g+s {} +     # files added later inherit the nginx group

# nginx must be able to traverse every parent directory
p="$WEB_ROOT"
while [[ "$p" != "/" ]]; do
  p="$(dirname "$p")"
  if ! runuser -u "$NGINX_USER" -- test -x "$p"; then
    warn "nginx cannot traverse $p — adding o+x (traverse only, not listing)"
    chmod o+x "$p"
  fi
done
if runuser -u "$NGINX_USER" -- test -r "$WEB_ROOT/index.html"; then
  log "Verified: $NGINX_USER can read $WEB_ROOT/index.html"
else
  die "$NGINX_USER still cannot read $WEB_ROOT/index.html (ACL/SELinux?)."
fi

# Separate ACME webroot so redeploys of the project never break renewals
install -d -m 755 "$ACME_ROOT/.well-known/acme-challenge"

# ----------------------------------------------------------------------------
# 3. certbot, DNS, firewall checks
# ----------------------------------------------------------------------------
if ! command -v certbot >/dev/null; then
  log "Installing certbot (core only, no nginx plugin)..."
  if command -v apt-get >/dev/null; then
    apt-get update -qq && apt-get install -y -qq certbot
  elif command -v dnf >/dev/null; then
    dnf install -y certbot
  else
    die "Install certbot manually, then re-run."
  fi
fi

MY_IP="$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
for name in $NAMES; do
  DNS_IP="$(getent ahostsv4 "$name" | awk 'NR==1{print $1}' || true)"
  [[ -n "$DNS_IP" ]] || die "$name does not resolve. Add an A record pointing to this server, then re-run."
  if [[ -n "$MY_IP" && "$DNS_IP" != "$MY_IP" ]]; then
    warn "$name -> $DNS_IP but this server is $MY_IP. Fine if proxied (e.g. Cloudflare); otherwise issuance will fail."
  else
    log "DNS OK: $name -> $DNS_IP"
  fi
done

if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  if ! ufw status | grep -Eq '(^|[[:space:]])(443|Nginx Full|Nginx HTTPS)([/[:space:]]|$)'; then
    warn "ufw is active and 443 may be closed. If HTTPS doesn't load: ufw allow 'Nginx Full'"
  fi
fi

# ----------------------------------------------------------------------------
# 4. Certificate (one for every name; expanded when REDIRECT_FROM is added later)
# ----------------------------------------------------------------------------
cert_covers_names() {
  [[ -s "$LE_LIVE/fullchain.pem" ]] || return 1
  local sans; sans="$(openssl x509 -in "$LE_LIVE/fullchain.pem" -noout -text 2>/dev/null | grep -o 'DNS:[^,[:space:]]*' || true)"
  for n in $NAMES; do grep -qx "DNS:$n" <<<"$sans" || return 1; done
}
request_cert() {
  local args=(); for n in $NAMES; do args+=(-d "$n"); done
  if [[ -n "$EMAIL" ]]; then EMAIL_ARGS=(-m "$EMAIL"); else EMAIL_ARGS=(--register-unsafely-without-email); fi
  log "Requesting certificate for: $NAMES"
  if ! certbot certonly --webroot -w "$ACME_ROOT" --cert-name "$DOMAIN" "${args[@]}" --expand \
        --non-interactive --agree-tos "${EMAIL_ARGS[@]}" \
        --deploy-hook "systemctl reload nginx"; then
    rollback
    die "certbot failed (see above). Rolled back; other sites unchanged."
  fi
}
if cert_covers_names; then
  log "Certificate for $NAMES already exists; reusing it."
elif [[ -s "$LE_LIVE/fullchain.pem" ]]; then
  # A certificate exists but lacks a name: keep HTTPS up and expand it (the HTTP block already answers every name).
  log "Expanding the existing certificate to: $NAMES"
  write_https_conf
  apply_conf
  request_cert
else
  log "Step 1/2: temporary HTTP vhost for the Let's Encrypt challenge"
  write_http_conf
  apply_conf
  SELFTEST="selftest-$TS"
  echo ok > "$ACME_ROOT/.well-known/acme-challenge/$SELFTEST"
  for name in $NAMES; do
    if curl -fsS --max-time 10 "http://$name/.well-known/acme-challenge/$SELFTEST" 2>/dev/null | grep -qx ok; then
      log "Challenge path reachable over HTTP for $name."
    else
      warn "Self-test couldn't reach the challenge path for $name (port 80 blocked? DNS not propagated?). Trying anyway."
    fi
  done
  rm -f "$ACME_ROOT/.well-known/acme-challenge/$SELFTEST"
  request_cert
fi

# ----------------------------------------------------------------------------
# 5. Final HTTPS vhost
# ----------------------------------------------------------------------------
log "Step 2/2: HTTPS vhost"
write_https_conf
apply_conf
CONFIG_TOUCHED=0   # success; nothing to roll back from here on

# ----------------------------------------------------------------------------
# 6. Static only: remove the server-side refresh job of earlier versions (1.11.x), if it is here
# ----------------------------------------------------------------------------
if [[ -f "$OLD_CRON_FILE" ]]; then
  rm -f "$OLD_CRON_FILE" /etc/logrotate.d/gl1f-crypto
  log "Removed the old refresh job ($OLD_CRON_FILE): the site needs nothing but nginx."
fi
for d in .venv .node .cache .npm node_modules; do
  if [[ -d "$PROJECT_DIR/$d" ]]; then rm -rf "${PROJECT_DIR:?}/$d"; log "Removed $PROJECT_DIR/$d (left by the old refresh job)."; fi
done
# Model pages generated by that job; models now open at model.html?id=<n> (old /m/<id>/ links are forwarded).
if [[ -f "$WEB_ROOT/m/models.json" ]]; then rm -rf "${WEB_ROOT:?}/m"; log "Removed the generated $WEB_ROOT/m folder."; fi

# ----------------------------------------------------------------------------
# 7. Verify
# ----------------------------------------------------------------------------
sleep 1
HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://$DOMAIN/" || true)"
HTTPS_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$DOMAIN/" || true)"
log "http://$DOMAIN  -> $HTTP_CODE (expect 301)"
log "https://$DOMAIN -> $HTTPS_CODE (expect 200)"
MODEL_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$DOMAIN/model.html?id=1" || true)"
log "https://$DOMAIN/model.html?id=1 -> $MODEL_CODE (expect 200: every model's page)"
if curl -s --max-time 10 "https://$DOMAIN/m/1/" | grep -q 'model.html?id='; then
  log "Old /m/<id>/ links get the 404 page, which forwards them to model.html?id=<id>."
else
  warn "https://$DOMAIN/m/1/ did not return the site's 404 page."
fi
if [[ -n "$REDIRECT_FROM" ]]; then
  LOC="$(curl -s -o /dev/null -w '%{redirect_url}' --max-time 10 "https://$REDIRECT_FROM/m/1/?x=1" || true)"
  log "https://$REDIRECT_FROM/m/1/?x=1 -> $LOC (expect https://$DOMAIN/m/1/?x=1)"
fi

log "Testing auto-renewal (dry run)..."
if certbot renew --dry-run --cert-name "$DOMAIN" -q; then
  log "Renewal dry run OK."
else
  warn "Renewal dry run failed; check: certbot renew --dry-run --cert-name $DOMAIN"
fi

cat <<EOF

==============================================================
 Done: https://$DOMAIN${REDIRECT_FROM:+  (and https://$REDIRECT_FROM -> 301)}
--------------------------------------------------------------
 Vhost:        $CONF_FILE
 Web root:     $WEB_ROOT
 Logs:         /var/log/nginx/$DOMAIN.{access,error}.log
 Certificate:  $LE_LIVE (auto-renews, reloads nginx)
 Backup:       $BACKUP
 Permissions:  $OWNER:$NGINX_GROUP, dirs 2750 / files 640

 MCP server:   ${MCP_PORT:+https://$DOMAIN/mcp (gl1f-mcp on port $MCP_PORT)}${MCP_PORT:-not served (install it with deploy/setup-mcp.sh, then run this again)}
 New release: replace the files in $WEB_ROOT with the new site folder. Nothing else.
==============================================================
EOF
