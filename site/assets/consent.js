/* GL1F Crypto: cookie notice and Google Analytics, consent first. MIT License, Copyright (c) 2026 Decentralized Science Labs.
   Google Analytics loads only after a visitor accepts (GDPR, ePrivacy): nothing is requested from Google before that.
   Set the measurement ID once in runtime-config.js (analytics.googleMeasurementId, "G-..."); with no ID the site sets
   no analytics cookies and shows no notice. "Cookie settings" (any element with data-cookie-settings) reopens it. */
(function () {
  "use strict";
  var KEY = "gl1f-consent", MAX_AGE = 365 * 864e5, memory = null, loaded = false, card = null;
  var cfg = (window.GL1F_RUNTIME && window.GL1F_RUNTIME.analytics) || {}, id = String(cfg.googleMeasurementId || "").trim();
  var enabled = /^(G|GT)-[A-Z0-9]{4,}$/i.test(id), INFO_KEY = "gl1f-cookie-info";
  var src = (document.currentScript && document.currentScript.getAttribute("src")) || "", root = src.replace(/assets\/consent\.js.*$/, "");
  function read() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && v.v === 1 && Date.now() - v.at < MAX_AGE ? v : null; } catch (e) { return memory; }
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
    setTimeout(function () { c.remove(); }, 250);
  }
  function choose(analytics) { write(analytics); hide(); if (analytics) loadAnalytics(); else stopAnalytics(); }
  function show() {
    if (card) return;
    card = document.createElement("div");
    card.className = "cookie-card"; card.setAttribute("role", "dialog"); card.setAttribute("aria-live", "polite"); card.setAttribute("aria-label", "Cookie notice");
    var policy = ' <a href="' + root + 'legal/cookies.html">Cookie policy</a>';
    card.innerHTML = enabled
      ? '<p>We\u2019d like to use cookies to count visits and improve the site. No ads, and only if you agree.' + policy + '</p><div class="cookie-actions"><button type="button" class="btn small" data-c="no">Decline</button><button type="button" class="btn small" data-c="yes">Accept</button></div>'
      : '<p>This site keeps only a few essential settings in your browser, like your theme. No statistics or advertising cookies.' + policy + '</p><div class="cookie-actions"><button type="button" class="btn small" data-c="ok">OK</button></div>';
    card.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("button[data-c]");
      if (!b) return;
      if (b.getAttribute("data-c") === "ok") { try { localStorage.setItem(INFO_KEY, String(Date.now())); } catch (e2) { /* private mode */ } hide(); } else choose(b.getAttribute("data-c") === "yes");
    });
    document.body.appendChild(card);
    var nav = document.querySelector(".bottom-nav");
    if (nav && getComputedStyle(nav).display !== "none") card.style.bottom = nav.offsetHeight + 10 + "px";
    requestAnimationFrame(function () { if (card) card.classList.add("show"); });
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
    if (!seen) setTimeout(show, 1200);
    return;
  }
  var saved = read();
  if (saved) { if (saved.analytics) loadAnalytics(); return; }
  if (navigator.globalPrivacyControl === true) { write(false); return; }  // honour Global Privacy Control: no analytics, no notice
  setTimeout(show, 1200);
})();
