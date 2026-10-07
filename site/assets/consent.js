/* GL1F Crypto: cookie notice and Google Analytics, consent first. MIT License, Copyright (c) 2026 Decentralized Science Labs.
   Google Analytics loads only after a visitor accepts (GDPR, ePrivacy): nothing is requested from Google before that.
   The prompt dims the page until the visitor chooses (Accept or Decline, the same size); a Decline is asked again after
   6 months, an Accept after 12. Set the measurement ID once in runtime-config.js (analytics.googleMeasurementId, "G-..."); with no ID the site sets
   no analytics cookies and shows no notice. "Cookie settings" (any element with data-cookie-settings) reopens it. */
(function () {
  "use strict";
  var KEY = "gl1f-consent", ACCEPT_AGE = 365 * 864e5, DECLINE_AGE = 182 * 864e5, memory = null, loaded = false, card = null, lastFocus = null;
  var cfg = (window.GL1F_RUNTIME && window.GL1F_RUNTIME.analytics) || {}, id = String(cfg.googleMeasurementId || "").trim();
  var enabled = /^(G|GT)-[A-Z0-9]{4,}$/i.test(id), INFO_KEY = "gl1f-cookie-info";
  var src = (document.currentScript && document.currentScript.getAttribute("src")) || "", root = src.replace(/assets\/consent\.js.*$/, "");
  function read() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && v.v === 1 && Date.now() - v.at < (v.analytics ? ACCEPT_AGE : DECLINE_AGE) ? v : null; } catch (e) { return memory; }
  }
  function write(analytics) {
    memory = { v: 1, analytics: !!analytics, at: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch (e) { /* private mode: remembered for this page only */ }
  }
  function loadAnalytics() {
    if (!enabled || loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "granted" });
    window.gtag("js", new Date());
    window.gtag("config", id, { allow_google_signals: false, allow_ad_personalization_signals: false });
    var s = document.createElement("script");
    s.async = true; s.id = "gl1f-ga"; s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    document.head.appendChild(s);
    window.addEventListener("hashchange", function () { if (loaded) window.gtag("event", "page_view", { page_location: location.href }); });
  }
  function stopAnalytics() {
    if (loaded && window.gtag) window.gtag("consent", "update", { analytics_storage: "denied" });
    var parts = location.hostname.split(".");
    document.cookie.split(";").map(function (c) { return c.split("=")[0].trim(); })
      .filter(function (n) { return n === "_ga" || n === "_gid" || n.indexOf("_ga_") === 0; })
      .forEach(function (n) {
        document.cookie = n + "=; Max-Age=0; path=/";
        for (var i = 0; i < parts.length - 1; i++) document.cookie = n + "=; Max-Age=0; path=/; domain=." + parts.slice(i).join(".");
      });
  }
  function hide() {
    if (!card) return;
    var c = card; card = null; c.classList.remove("show");
    document.documentElement.classList.remove("cookie-open");
    document.removeEventListener("keydown", trap, true);
    setTimeout(function () { c.remove(); }, 260);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* gone */ } }
  }
  function trap(e) {   // keyboard focus stays in the prompt while it is open
    if (!card || e.key !== "Tab") return;
    var f = card.querySelectorAll("button, a[href]"); if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function choose(analytics) { write(analytics); hide(); if (analytics) loadAnalytics(); else stopAnalytics(); }
  function show() {
    if (card) return;
    var policy = '<a href="' + root + 'legal/cookies.html">Cookie policy</a>';
    if (!enabled) {   // no statistics configured: a small one-time note, nothing to consent to
      card = document.createElement("div");
      card.className = "cookie-card"; card.setAttribute("role", "dialog"); card.setAttribute("aria-live", "polite"); card.setAttribute("aria-label", "Cookie notice");
      card.innerHTML = '<p>This site keeps only a few essential settings in your browser, like your theme. No statistics or advertising cookies. ' + policy + '</p><div class="cookie-actions"><button type="button" class="btn small" data-c="ok">OK</button></div>';
      card.addEventListener("click", function (e) {
        if (!(e.target.closest && e.target.closest('button[data-c="ok"]'))) return;
        try { localStorage.setItem(INFO_KEY, String(Date.now())); } catch (e2) { /* private mode */ }
        hide();
      });
      document.body.appendChild(card);
      var nav = document.querySelector(".bottom-nav");
      if (nav && getComputedStyle(nav).display !== "none") card.style.bottom = nav.offsetHeight + 10 + "px";
      requestAnimationFrame(function () { if (card) card.classList.add("show"); });
      return;
    }
    // Statistics: a prompt in the middle of the screen (a bottom sheet on phones) over a dimmed page, until the visitor
    // chooses. Accept and Decline are the same size; nothing from Google loads before Accept.
    lastFocus = document.activeElement;
    var gpc = navigator.globalPrivacyControl === true;
    card = document.createElement("div");
    card.className = "cookie-layer";
    card.innerHTML = '<div class="cookie-prompt" role="dialog" aria-modal="true" aria-labelledby="gl1f-ck-title" aria-describedby="gl1f-ck-text">' +
      '<div class="cookie-head"><span class="cookie-badge" aria-hidden="true">\uD83C\uDF6A</span><h2 id="gl1f-ck-title">Help us make GL1F Crypto better</h2></div>' +
      '<p id="gl1f-ck-text">May we count visits with Google Analytics? It shows us which pages and features people use, so we know what to build next. No ads, no selling of data, and nothing loads unless you say yes.</p>' +
      (gpc ? '<p class="cookie-gpc">Your browser asks sites not to sell or share your data. We never do, whatever you choose here.</p>' : '') +
      '<div class="cookie-actions"><button type="button" class="btn hype" data-c="yes">Accept analytics</button><button type="button" class="btn2" data-c="no">Decline</button></div>' +
      '<p class="cookie-fine">Change it anytime with Cookie settings at the bottom of every page. ' + policy + '</p></div>';
    card.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("button[data-c]");
      if (b) choose(b.getAttribute("data-c") === "yes");
    });
    document.body.appendChild(card);
    document.documentElement.classList.add("cookie-open");
    document.addEventListener("keydown", trap, true);
    requestAnimationFrame(function () {
      if (!card) return;
      card.classList.add("show");
      var yes = card.querySelector('[data-c="yes"]'); if (yes) { try { yes.focus({ preventScroll: true }); } catch (e) { yes.focus(); } }
    });
  }
  function ask() {   // as soon as the page is there
    if (document.body) setTimeout(show, 250);
    else document.addEventListener("DOMContentLoaded", function () { setTimeout(show, 250); });
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-cookie-settings]");
    if (a) { e.preventDefault(); show(); }
  });
  window.GL1FConsent = {
    open: show, accept: function () { choose(true); }, decline: function () { choose(false); },
    state: function () { var v = read(); return { enabled: enabled, decided: !!v, analytics: !!(v && v.analytics), loaded: loaded }; },
  };
  if (!enabled) {
    // No statistics configured: a short notice on the first visit (OK), nothing to consent to.
    var seen = null; try { seen = localStorage.getItem(INFO_KEY); } catch (e) { /* private mode */ }
    if (!seen) ask();
    return;
  }
  var saved = read();
  if (saved) { if (saved.analytics) loadAnalytics(); return; }
  // Not decided yet: ask on every page until the visitor chooses. Browsers that send Global Privacy Control are asked
  // too (the prompt says the Site never sells or shares data); analytics still runs only after Accept.
  ask();
})();
