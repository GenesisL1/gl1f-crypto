/* MIT License — Copyright (c) 2026 Decentralized Science Labs. Applies the saved or system theme before first paint. */
(function () {
  var theme = "light";
  try {
    var saved = localStorage.getItem("gl1f-theme");
    theme = saved === "dark" || saved === "light" ? saved : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  } catch (e) { /* storage unavailable */ }
  document.documentElement.setAttribute("data-theme", theme);
})();
