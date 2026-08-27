(function () {
  var KEY = "personalized-secure:locale:v1";
  function normalize(v) {
    v = String(v || "").toLowerCase();
    return v.indexOf("en") === 0 ? "en" : "zh";
  }
  function readLang() {
    try {
      var qs = new URLSearchParams(location.search);
      return normalize(qs.get("lang") || qs.get("locale") || localStorage.getItem(KEY) || "zh");
    } catch (e) {
      return "zh";
    }
  }
  var lang = readLang();
  try { localStorage.setItem(KEY, lang); } catch (e) {}
  document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
  document.documentElement.setAttribute("data-app-i18n", "ready");
  document.documentElement.setAttribute("data-app-locale", lang === "en" ? "en-US" : "zh-CN");
  window.AppI18n = window.AppI18n || {};
  Object.assign(window.AppI18n, {
    getLang: function () { return lang; },
    getLocale: function () { return lang === "en" ? "en-US" : "zh-CN"; },
    setLocale: function (next) {
      lang = normalize(next);
      try { localStorage.setItem(KEY, lang); } catch (e) {}
      document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
      window.dispatchEvent(new CustomEvent("personalized-secure:locale-change", { detail: lang }));
      return lang;
    },
    t: function (zh, en) { return lang === "en" ? (en || zh) : zh; }
  });
  if (!window.__aix_locale_fetch_patch && typeof window.fetch === "function") {
    window.__aix_locale_fetch_patch = true;
    var nativeFetch = window.fetch;
    window.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      if (url.indexOf("/personalized-secure-api/") !== -1) {
        init = init || {};
        var headers = new Headers(init.headers || {});
        var loc = lang === "en" ? "en-US" : "zh-CN";
        headers.set("X-App-Locale", loc);
        headers.set("Accept-Language", loc);
        init.headers = headers;
      }
      return nativeFetch.call(this, input, init);
    };
  }
})();
