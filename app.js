/* Dartmouth Eats Tracker — single-file front-end logic */

const STORAGE_KEY = "dartmouth_eats_log_v1";

/* ---------- Storage ---------- */
function loadLog() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
}
function saveLog(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

/* ---------- Tabs ---------- */
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById("tab-" + tab).classList.add("active");
    if (tab === "stats") renderStats();
    if (tab === "log") renderHistory();
    if (tab === "now") renderNow();
    if (tab === "plan") renderPlan();
  });
});

/* ---------- Now tab ---------- */
function fmtTime(d) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function dayName(d) {
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}
function decimalHour(d) { return d.getHours() + d.getMinutes() / 60; }

function findCurrentWindow(now) {
  const dh = decimalHour(now);
  const dow = now.getDay();
  // Find the most specific match: prefer entries whose dow includes today
  return PLAYBOOK.find(p =>
    dh >= p.start && dh < p.end && (p.dow === null || p.dow.includes(dow))
  );
}

function findNextWindow(now) {
  const dh = decimalHour(now);
  const dow = now.getDay();
  // Look ahead through today only (simple heuristic)
  const today = PLAYBOOK
    .filter(p => p.start > dh && (p.dow === null || p.dow.includes(dow)))
    .sort((a, b) => a.start - b.start);
  if (today.length) return today[0];
  // Otherwise first window of tomorrow
  const tomDow = (dow + 1) % 7;
  const tom = PLAYBOOK
    .filter(p => p.dow === null || p.dow.includes(tomDow))
    .sort((a, b) => a.start - b.start);
  return tom[0];
}

function fmtWindow(p) {
  const fmt = h => {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    const d = new Date();
    d.setHours(hh, mm, 0, 0);
    return d.toLocaleTimeString([], { hour: "numeric", minute: mm ? "2-digit" : undefined });
  };
  return `${fmt(p.start)} – ${fmt(p.end)}`;
}

function renderNow() {
  const now = new Date();
  document.getElementById("nowTime").textContent = fmtTime(now);
  document.getElementById("nowDay").textContent = dayName(now);

  const cur = findCurrentWindow(now);
  if (cur) {
    document.getElementById("recZone").textContent = cur.zone;
    document.getElementById("recWhy").textContent = cur.why;
    document.getElementById("recWindow").textContent = "Window: " + fmtWindow(cur);
  } else {
    document.getElementById("recZone").textContent = "Outside playbook hours";
    document.getElementById("recWhy").textContent =
      "Demand is very low. Consider taking a break or running airport / late-night runs.";
    document.getElementById("recWindow").textContent = "";
  }

  const nxt = findNextWindow(now);
  if (nxt) {
    document.getElementById("nextWhen").textContent = fmtWindow(nxt);
    document.getElementById("nextZone").textContent = nxt.zone;
  }
}

/* ---------- Plan tab ---------- */
function renderPlan() {
  const list = document.getElementById("planList");
  list.innerHTML = "";
  const now = new Date();
  const dh = decimalHour(now);
  const dow = now.getDay();

  PLAYBOOK.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "plan-row";
    const isNow = dh >= p.start && dh < p.end && (p.dow === null || p.dow.includes(dow));
    if (isNow) row.classList.add("active");
    const dowLabel = p.dow === null
      ? "Every day"
      : p.dow.length === 7 ? "Every day"
      : p.dow.map(d => ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d]).join(", ");
    row.innerHTML = `
      <div class="plan-time">${fmtWindow(p)} · ${dowLabel}</div>
      <div class="plan-zone">${p.zone}</div>
      <div class="plan-why">${p.why}</div>
      <div class="plan-detail">${p.detail}</div>
    `;
    row.addEventListener("click", () => row.classList.toggle("open"));
    list.appendChild(row);
  });
}

/* ---------- Log tab ---------- */
function populateZoneOptions() {
  const sel = document.getElementById("fZone");
  sel.innerHTML = ZONES.map(z => `<option>${z}</option>`).join("");
  const dl = document.getElementById("restaurantList");
  dl.innerHTML = RESTAURANTS.map(r => `<option value="${r}">`).join("");
}

function suggestedZone() {
  const now = new Date();
  const cur = findCurrentWindow(now);
  if (!cur) return "Other";
  // Map zone description to a value in ZONES
  const z = cur.zone;
  if (/Burnside/i.test(z)) return "Burnside";
  if (/Crossing/i.test(z)) return "Dartmouth Crossing";
  if (/Mic Mac|Tacoma/i.test(z)) return "Mic Mac / Tacoma Dr";
  if (/Portland|Downtown Dartmouth|Alderney/i.test(z)) return "Downtown Dartmouth (Portland St)";
  if (/Cole Harbour/i.test(z)) return "Cole Harbour Rd";
  if (/Main St|Penhorn/i.test(z)) return "Main St / Penhorn";
  return "Other";
}

document.getElementById("logForm").addEventListener("submit", e => {
  e.preventDefault();
  const entry = {
    id: Date.now(),
    ts: new Date().toISOString(),
    zone: document.getElementById("fZone").value,
    restaurant: document.getElementById("fRestaurant").value.trim() || "Unknown",
    pay: parseFloat(document.getElementById("fPay").value) || 0,
    tip: parseFloat(document.getElementById("fTip").value) || 0,
    km: parseFloat(document.getElementById("fKm").value) || 0,
    min: parseFloat(document.getElementById("fMin").value) || 0,
    wait: parseFloat(document.getElementById("fWait").value) || 0,
    app: document.getElementById("fApp").value,
    notes: document.getElementById("fNotes").value.trim()
  };
  const log = loadLog();
  log.unshift(entry);
  saveLog(log);
  e.target.reset();
  document.getElementById("fZone").value = suggestedZone();
  toast("Saved");
  renderHistory();
});

document.getElementById("quickLogBtn").addEventListener("click", () => {
  document.querySelector('.tab[data-tab="log"]').click();
  document.getElementById("fZone").value = suggestedZone();
  document.getElementById("fPay").focus();
});

function renderHistory() {
  const log = loadLog();
  const ul = document.getElementById("historyList");
  ul.innerHTML = "";
  document.getElementById("historyCount").textContent = `${log.length} entries`;
  log.slice(0, 50).forEach(e => {
    const total = e.pay + e.tip;
    const perKm = e.km > 0 ? total / e.km : 0;
    const perHr = e.min > 0 ? total / (e.min / 60) : 0;
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <div class="h-rest">${escapeHtml(e.restaurant)}</div>
        <div class="h-meta">${escapeHtml(e.zone)} · ${e.min}min · ${e.km}km · ${new Date(e.ts).toLocaleString([], {month:"short", day:"numeric", hour:"numeric", minute:"2-digit"})}</div>
      </div>
      <div>
        <div class="h-pay">$${total.toFixed(2)}</div>
        <div class="h-rate">$${perKm.toFixed(2)}/km · $${perHr.toFixed(0)}/hr</div>
      </div>
    `;
    ul.appendChild(li);
  });
}

document.getElementById("clearBtn").addEventListener("click", () => {
  if (confirm("Delete ALL logged deliveries? This can't be undone.")) {
    saveLog([]);
    renderHistory();
    toast("Cleared");
  }
});

document.getElementById("exportBtn").addEventListener("click", () => {
  const log = loadLog();
  if (!log.length) { toast("No data to export"); return; }
  const headers = ["timestamp","zone","restaurant","pay","tip","km","min","wait_min","app","notes"];
  const rows = log.map(e => [
    e.ts, e.zone, e.restaurant, e.pay, e.tip, e.km, e.min, e.wait, e.app,
    (e.notes || "").replace(/"/g, '""')
  ]);
  const csv = [headers, ...rows].map(r =>
    r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")
  ).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dartmouth-eats-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

/* ---------- Stats tab ---------- */
function filterByRange(log, range) {
  const now = new Date();
  if (range === "all") return log;
  if (range === "today") {
    const start = new Date(now); start.setHours(0,0,0,0);
    return log.filter(e => new Date(e.ts) >= start);
  }
  const days = parseInt(range, 10);
  const cutoff = now.getTime() - days * 86400000;
  return log.filter(e => new Date(e.ts).getTime() >= cutoff);
}

function renderStats() {
  const range = document.getElementById("statRange").value;
  const log = filterByRange(loadLog(), range);

  const totalEarn = log.reduce((s, e) => s + (e.pay + e.tip), 0);
  const totalMin  = log.reduce((s, e) => s + e.min, 0);
  const totalKm   = log.reduce((s, e) => s + e.km, 0);

  document.getElementById("sCount").textContent = log.length;
  document.getElementById("sEarn").textContent  = "$" + totalEarn.toFixed(0);
  document.getElementById("sPerHr").textContent =
    totalMin > 0 ? "$" + (totalEarn / (totalMin / 60)).toFixed(0) : "$0";
  document.getElementById("sPerKm").textContent =
    totalKm > 0 ? "$" + (totalEarn / totalKm).toFixed(2) : "$0";

  // Best zones (sum)
  const byZone = aggregate(log, "zone");
  const byRest = aggregate(log, "restaurant");

  renderRank("bestZones", topByPerHr(byZone), "$/hr");
  renderRank("bestRestaurants", topByPerHr(byRest), "$/hr");
  renderRank("worstRestaurants",
    topByPerHr(byRest).filter(r => r.count >= 2).slice().reverse().slice(0, 5),
    "$/hr");

  // Best hours of day
  const byHour = {};
  log.forEach(e => {
    const h = new Date(e.ts).getHours();
    byHour[h] = byHour[h] || { name: hourLabel(h), earn: 0, min: 0, count: 0 };
    byHour[h].earn += e.pay + e.tip;
    byHour[h].min  += e.min;
    byHour[h].count++;
  });
  const hoursList = Object.values(byHour).map(o => ({
    name: o.name,
    perHr: o.min > 0 ? o.earn / (o.min / 60) : 0,
    count: o.count,
    earn: o.earn,
    min: o.min
  })).filter(o => o.count >= 1).sort((a,b) => b.perHr - a.perHr).slice(0, 6);
  renderRank("bestHours", hoursList, "$/hr");
}

function hourLabel(h) {
  const d = new Date(); d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric" });
}

function aggregate(log, key) {
  const map = {};
  log.forEach(e => {
    const k = e[key] || "Unknown";
    map[k] = map[k] || { name: k, earn: 0, min: 0, count: 0, km: 0 };
    map[k].earn += e.pay + e.tip;
    map[k].min  += e.min;
    map[k].km   += e.km;
    map[k].count++;
  });
  return map;
}

function topByPerHr(map) {
  return Object.values(map)
    .map(o => ({ ...o, perHr: o.min > 0 ? o.earn / (o.min / 60) : 0 }))
    .filter(o => o.count >= 1)
    .sort((a, b) => b.perHr - a.perHr)
    .slice(0, 5);
}

function renderRank(elId, items, unit) {
  const ul = document.getElementById(elId);
  ul.innerHTML = "";
  if (!items.length) {
    ul.innerHTML = `<li class="muted small">Not enough data yet — log a few deliveries.</li>`;
    return;
  }
  items.forEach(o => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <div class="name">${escapeHtml(o.name)}</div>
        <div class="sub">${o.count} order${o.count===1?"":"s"} · $${o.earn.toFixed(0)} total</div>
      </div>
      <div class="val">$${o.perHr.toFixed(0)} ${unit}</div>
    `;
    ul.appendChild(li);
  });
}

document.getElementById("statRange").addEventListener("change", renderStats);

/* ---------- Toast & helpers ---------- */
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 1500);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}

/* ---------- Init ---------- */
populateZoneOptions();
renderNow();
renderHistory();
// Tick the clock every 30s
setInterval(() => {
  if (document.getElementById("tab-now").classList.contains("active")) renderNow();
}, 30000);

/* ---------- Service worker registration (PWA install) ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
