# Host GL1F Crypto

GL1F Crypto is a static site: HTML and JavaScript that read GenesisL1 from the visitor's browser. Nothing runs on
the server. Upload the `site/` folder (or the `gl1f-crypto-site` zip) to any static host and it works.

Each model's page is `model.html?id=<n>`. Old links of the form `/m/<n>/` are forwarded there by `404.html` on hosts
that serve it for missing paths (nginx with this script, GitHub Pages, Netlify, Cloudflare Pages).

## nginx

1. DNS: an A (and AAAA) record for `crypto.gl1f.com` pointing at the server.
2. Put the site at `/var/www/crypto.gl1f.com` (unzip the site zip there, so `index.html` is directly inside).
3. `sudo bash setup-crypto-nginx.sh` (add `REDIRECT_FROM=stagecrypto.gl1f.com` to turn a staging domain into a
   permanent redirect; disable its own vhost first).

The script only touches its own vhost file, backs up /etc/nginx, tests before every reload and rolls back on failure,
and gets a Let's Encrypt certificate with `certbot --webroot`. It also removes the refresh job of versions 1.11.x if
it finds one. `PRINT_CONFIG=1` prints the vhost without changing anything.

## A new release

Replace the files with the new site folder. Nothing else: pages are always revalidated and scripts are versioned, so
visitors get the release at once.
