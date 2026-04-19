/* auth.js - Authentication helpers for Compass7 */
const API = "";

async function apiCall(url, options = {}) {
  const defaults = {
    headers: { "Content-Type": "application/json" },
    credentials: "include"
  };
  const res = await fetch(API + url, { ...defaults, ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function showToast(message, type = "success") {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove("show"), 3000);
}
