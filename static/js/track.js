/* track.js - Lightweight anonymous visit tracking for Compass7
 *
 * Fires a single fire-and-forget POST /api/track on page load. The server
 * decides whether the visit is a guest (游客) or a registered user (注册用户)
 * based on the session cookie — this script only supplies the page key and a
 * stable anonymous visitor id (used for unique-visitor counts).
 *
 * Privacy: the visitor id is a random value stored in localStorage. It is not
 * tied to any personal information and is only used to de-duplicate visitors.
 */
(function () {
  "use strict";

  var VISITOR_KEY = "compass7_vid";

  function getVisitorId() {
    try {
      var id = localStorage.getItem(VISITOR_KEY);
      if (!id) {
        if (window.crypto && window.crypto.randomUUID) {
          id = window.crypto.randomUUID();
        } else {
          id = "v-" + Date.now().toString(36) + "-" +
               Math.random().toString(36).slice(2, 10);
        }
        localStorage.setItem(VISITOR_KEY, id);
      }
      return id;
    } catch (e) {
      // localStorage blocked (private mode) — still track, just no unique id.
      return "";
    }
  }

  function pageKey() {
    // Map pathname to a logical page key the backend understands.
    var p = (window.location.pathname || "").replace(/\/+$/, "");
    if (p === "" || p === "/home") return "home";
    if (p.indexOf("/timetable") === 0) return "timetable";
    if (p.indexOf("/clubs") === 0) return "clubs";
    if (p.indexOf("/admin") === 0) return "admin"; // ignored server-side
    return "other";
  }

  function track() {
    var page = pageKey();
    // Never count admin page loads as public traffic.
    if (page === "admin") return;

    var payload = JSON.stringify({ page: page, visitor_id: getVisitorId() });

    // Prefer sendBeacon so the request survives navigation; fall back to fetch.
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/track", blob);
        return;
      }
    } catch (e) { /* fall through to fetch */ }

    try {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        credentials: "include",
        keepalive: true
      }).catch(function () {});
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(track, 0);
  } else {
    document.addEventListener("DOMContentLoaded", track);
  }
})();
