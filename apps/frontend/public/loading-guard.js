(function () {
  "use strict";

  // Session initialization can legitimately take longer on a cold start.
  // Never replace the React document or clear authentication from a timer.
  var legacyPanel = document.getElementById("__aix_loading_guard_panel");
  if (legacyPanel) {
    window.location.reload();
  }
})();
