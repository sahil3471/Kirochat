/* Dartmouth Eats Tracker — single-file front-end logic */

const STORAGE_KEY = "dartmouth_eats_log_v1";

/* ID of the entry currently being edited (null = create-new mode) */
let editingId = null;

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
  return PLAYBOOK.find(p =>
    dh >= p.start && dh < p.end && (p.dow === null || p.dow.includes(dow))
  );
}

function findNextWindow(now) {
  const dh = decimalHour(now);
  const dow = now.getDay();
  const today = PLAYBOOK
    .filter(p => p.start > dh && (p.dow === null || p.dow.includes(dow)))
    .sort((a, b) => a.start - b.start);
  if (today.length) return today[0];
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

/* ---------- Day-of-week / time-window helpers ---------- */
const DAY_FULL  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
// Mon-first ordering for display (1,2,3,4,5,6,0)
const DAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
// Time-window size used for bucketing deliveries.
// 2 hours = 12 windows per day (0-2, 2-4, ..., 22-24).
const WINDOW_SIZE_HOURS = 2;
// A bucket needs at least this many deliveries before its $/hr is trusted.
// With <2 we fall back to total $ earned so the user still sees *something*.
const MIN_ORDERS_FOR_CONFIDENCE = 2;

function windowStartFor(hour) {
  return Math.floor(hour / WINDOW_SIZE_HOURS) * WINDOW_SIZE_HOURS;
}

function fmtHour12(h) {
  h = ((h % 24) + 24) % 24;
  if (h === 0)  return "12 AM";
  if (h === 12) return "12 PM";
  if (h < 12)   return `${h} AM`;
  return `${h - 12} PM`;
}

function fmtWindowRange(startH) {
  return `${fmtHour12(startH)} – ${fmtHour12(startH + WINDOW_SIZE_HOURS)}`;
}

/* ---------- Bucketing & ranking ---------- */

/* Count distinct clock-hours (unique date + hour-of-day pairs) in a delivery
 * list. This is THE definition of "hours worked" used everywhere $/hr is
 * displayed. Example: a delivery at 6:45pm and another at 7:15pm same day
 * = 2 distinct clock-hours, even though only ~30 minutes of driving happened. */
function distinctClockHours(deliveries) {
  const set = new Set();
  deliveries.forEach(e => {
    const d = new Date(e.ts);
    set.add(`${d.toDateString()}|${d.getHours()}`);
  });
  return set.size;
}

/* Group deliveries into (day-of-week, time-window, zone) buckets and compute
 * earn / minutes / $/hr per bucket. */
function bucketizeByZone(log) {
  const buckets = {};
  log.forEach(e => {
    const d = new Date(e.ts);
    const dow = d.getDay();
    const ws  = windowStartFor(decimalHour(d));
    const zone = e.zone || "Unknown";
    const key = `${dow}|${ws}|${zone}`;
    const o = buckets[key] || (buckets[key] = {
      dow, ws, zone, earn: 0, min: 0, count: 0
    });
    o.earn += (e.pay || 0) + (e.tip || 0);
    o.min  += e.min || 0;
    o.count++;
  });
  // $/hr = total earned in this bucket ÷ window size (2 hours).
  // This gives the real average per clock-hour, not extrapolated.
  Object.values(buckets).forEach(b => {
    b.perHr = b.earn / WINDOW_SIZE_HOURS;
  });
  return Object.values(buckets);
}

/* Group deliveries into (day-of-week, hour-of-day) buckets. */
function bucketizeByHour(log) {
  const buckets = {};
  log.forEach(e => {
    const d = new Date(e.ts);
    const dow = d.getDay();
    const h = d.getHours();
    const key = `${dow}|${h}`;
    const o = buckets[key] || (buckets[key] = {
      dow, hour: h, earn: 0, min: 0, count: 0, dates: new Set()
    });
    o.earn += (e.pay || 0) + (e.tip || 0);
    o.min  += e.min || 0;
    o.count++;
    // Track which distinct dates contributed — so $/hr divides by the number
    // of times the user has actually worked this dow+hour slot.
    o.dates.add(d.toDateString());
  });
  // $/hr = total earned in this bucket ÷ how many separate days it represents.
  // E.g. earned $20 on one Friday 7pm and $30 on another Friday 7pm
  //   → $50 / 2 days = $25/hr (the average Friday-7pm).
  Object.values(buckets).forEach(b => {
    b.hours = b.dates.size;
    b.perHr = b.hours > 0 ? b.earn / b.hours : 0;
  });
  return Object.values(buckets);
}

/* Pick the highest-$/hr bucket from a candidate list, requiring 2+ orders
 * for confidence. If no bucket has 2+ orders, fall back to highest total $
 * (so a user with little data still gets a recommendation). */
function pickBest(buckets) {
  if (!buckets.length) return null;
  const confident = buckets.filter(b => b.count >= MIN_ORDERS_FOR_CONFIDENCE);
  const list = confident.length ? confident : buckets;
  return list.slice().sort((a, b) =>
    (b.perHr - a.perHr) || (b.earn - a.earn) || (b.count - a.count)
  )[0];
}

/* ---------- Plan tab ---------- */
function renderPlan() {
  renderDynamicPlan();
}

/* The Plan tab is fully data-driven. It reads ALL logged deliveries and shows:
 *   1. Right now — the best zone for the current day-of-week + time window.
 *   2. Today's plan — best zone for each 2-hour slot of today (6 AM – 12 AM).
 *   3. Best slot by day of week — single best (window, zone) pick per day. */
function renderDynamicPlan() {
  const wrap = document.getElementById("dynamicPlan");
  if (!wrap) return;

  const log = loadLog();
  const zoneBuckets = bucketizeByZone(log);

  const now    = new Date();
  const curDow = now.getDay();
  const curWs  = windowStartFor(decimalHour(now));

  // 1. Right now
  const nowCandidates = zoneBuckets.filter(b => b.dow === curDow && b.ws === curWs);
  const nowBest = pickBest(nowCandidates);

  // 2. Today's plan — every 2h slot from 6 AM to midnight.
  const todayWindows = [];
  for (let h = 6; h < 24; h += WINDOW_SIZE_HOURS) {
    const candidates = zoneBuckets.filter(b => b.dow === curDow && b.ws === h);
    todayWindows.push({ ws: h, best: pickBest(candidates) });
  }

  // 3. Weekly outlook — best (window, zone) pick per day-of-week.
  const weekly = DAY_DISPLAY_ORDER.map(dow => ({
    dow,
    best: pickBest(zoneBuckets.filter(b => b.dow === dow))
  }));

  // ----- render -----
  let html = "";

  // Right-now hero card
  html += `
    <div class="card recommend">
      <div class="rec-label">Right now · ${DAY_FULL[curDow]} ${fmtWindowRange(curWs)}</div>`;
  if (nowBest) {
    html += `
      <div class="rec-zone">${escapeHtml(nowBest.zone)}</div>
      <div class="rec-why">$${nowBest.perHr.toFixed(0)}/hr based on ${nowBest.count} past delivery${nowBest.count===1?"":"s"} · $${nowBest.earn.toFixed(0)} total earned</div>`;
  } else {
    html += `
      <div class="rec-zone">No data yet</div>
      <div class="rec-why">Log a few deliveries during this slot and your zone recommendation will show up here.</div>`;
  }
  html += `</div>`;

  // Today's plan card
  html += `
    <div class="card">
      <div class="section-title">${DAY_FULL[curDow]}'s plan</div>
      <p class="muted small">Best zone for each 2-hour slot, based on every delivery you've ever logged on a ${DAY_FULL[curDow]}.</p>`;
  todayWindows.forEach(w => {
    const isCurrent = w.ws === curWs;
    if (w.best) {
      html += `
        <div class="plan-row${isCurrent ? " active" : ""}">
          <div class="plan-time">${fmtWindowRange(w.ws)}${isCurrent ? " · now" : ""}</div>
          <div class="plan-zone">${escapeHtml(w.best.zone)}</div>
          <div class="plan-why">$${w.best.perHr.toFixed(0)}/hr · $${w.best.earn.toFixed(0)} earned · ${w.best.count} order${w.best.count===1?"":"s"}</div>
        </div>`;
    } else {
      html += `
        <div class="plan-row${isCurrent ? " active" : ""}">
          <div class="plan-time">${fmtWindowRange(w.ws)}${isCurrent ? " · now" : ""}</div>
          <div class="plan-zone muted">— no data yet —</div>
        </div>`;
    }
  });
  html += `</div>`;

  // Weekly outlook
  html += `
    <div class="card">
      <div class="section-title">Best slot by day of week</div>
      <p class="muted small">Single highest-$/hr (window, zone) pick for each day, all-time.</p>`;
  weekly.forEach(({ dow, best }) => {
    if (best) {
      html += `
        <div class="plan-row${dow === curDow ? " active" : ""}">
          <div class="plan-time">${DAY_FULL[dow]} · ${fmtWindowRange(best.ws)}</div>
          <div class="plan-zone">${escapeHtml(best.zone)}</div>
          <div class="plan-why">$${best.perHr.toFixed(0)}/hr · $${best.earn.toFixed(0)} earned · ${best.count} order${best.count===1?"":"s"}</div>
        </div>`;
    } else {
      html += `
        <div class="plan-row">
          <div class="plan-time">${DAY_FULL[dow]}</div>
          <div class="plan-zone muted">— no data yet —</div>
        </div>`;
    }
  });
  html += `</div>`;

  wrap.innerHTML = html;
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
  const z = cur.zone;
  if (/Burnside/i.test(z)) return "Burnside";
  if (/Crossing/i.test(z)) return "Dartmouth Crossing";
  if (/Mic Mac|Tacoma/i.test(z)) return "Mic Mac";
  if (/Portland|Downtown Dartmouth|Alderney/i.test(z)) return "Downtown Dartmouth (Portland St)";
  if (/Cole Harbour/i.test(z)) return "Cole Harbour Rd";
  if (/Main St|Penhorn/i.test(z)) return "Main St / Penhorn";
  return "Other";
}

document.getElementById("logForm").addEventListener("submit", e => {
  e.preventDefault();
  const formData = {
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

  if (editingId !== null) {
    // Update existing entry; preserve id and ts.
    const idx = log.findIndex(x => x.id === editingId);
    if (idx !== -1) {
      log[idx] = { ...log[idx], ...formData };
      saveLog(log);
      toast("Updated");
    }
    exitEditMode();
  } else {
    // Create new entry.
    const entry = {
      id: Date.now(),
      ts: new Date().toISOString(),
      ...formData
    };
    log.unshift(entry);
    saveLog(log);
    toast("Saved");
  }

  e.target.reset();
  document.getElementById("fZone").value = suggestedZone();
  renderHistory();
});

function enterEditMode(entry) {
  editingId = entry.id;
  document.getElementById("fZone").value = entry.zone;
  document.getElementById("fRestaurant").value = entry.restaurant === "Unknown" ? "" : entry.restaurant;
  document.getElementById("fPay").value = entry.pay;
  document.getElementById("fTip").value = entry.tip || "";
  document.getElementById("fKm").value = entry.km;
  document.getElementById("fMin").value = entry.min;
  document.getElementById("fWait").value = entry.wait || "";
  document.getElementById("fApp").value = entry.app || "Uber Eats";
  document.getElementById("fNotes").value = entry.notes || "";
  document.getElementById("formSubmitBtn").textContent = "Update delivery";
  document.getElementById("cancelEditBtn").hidden = false;
  document.querySelector('.tab[data-tab="log"]').click();
  document.getElementById("logForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

function exitEditMode() {
  editingId = null;
  document.getElementById("formSubmitBtn").textContent = "Save delivery";
  document.getElementById("cancelEditBtn").hidden = true;
}

document.getElementById("cancelEditBtn").addEventListener("click", () => {
  document.getElementById("logForm").reset();
  document.getElementById("fZone").value = suggestedZone();
  exitEditMode();
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
    const li = document.createElement("li");
    li.dataset.id = e.id;
    li.innerHTML = `
      <div>
        <div class="h-rest">${escapeHtml(e.restaurant)}</div>
        <div class="h-meta">${escapeHtml(e.zone)} · ${e.min}min · ${e.km}km · ${new Date(e.ts).toLocaleString([], {month:"short", day:"numeric", hour:"numeric", minute:"2-digit"})}</div>
        <div class="h-actions">
          <button type="button" class="btn small h-edit" data-action="edit">Edit</button>
          <button type="button" class="btn danger small h-delete" data-action="delete">Delete</button>
        </div>
      </div>
      <div>
        <div class="h-pay">$${total.toFixed(2)}</div>
        <div class="h-rate">$${perKm.toFixed(2)}/km</div>
      </div>
    `;
    ul.appendChild(li);
  });
}

document.getElementById("historyList").addEventListener("click", ev => {
  const btn = ev.target.closest("button[data-action]");
  if (!btn) return;
  const li = btn.closest("li[data-id]");
  if (!li) return;
  const id = Number(li.dataset.id);
  const log = loadLog();
  const entry = log.find(x => x.id === id);
  if (!entry) return;

  if (btn.dataset.action === "edit") {
    enterEditMode(entry);
  } else if (btn.dataset.action === "delete") {
    const label = entry.restaurant && entry.restaurant !== "Unknown" ? entry.restaurant : "this delivery";
    if (confirm(`Delete ${label}? This can't be undone.`)) {
      const next = log.filter(x => x.id !== id);
      saveLog(next);
      // If we were editing this entry, exit edit mode.
      if (editingId === id) {
        document.getElementById("logForm").reset();
        document.getElementById("fZone").value = suggestedZone();
        exitEditMode();
      }
      renderHistory();
      toast("Deleted");
    }
  }
});

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

  const totalEarn  = log.reduce((s, e) => s + (e.pay + e.tip), 0);
  const totalKm    = log.reduce((s, e) => s + e.km, 0);
  // Real clock-hours worked = distinct (date, hour) pairs in the filtered log.
  // Example: $20 at 6:30pm + $20 at 7:30pm same day → 2 hours → $20/hr.
  const totalHours = distinctClockHours(log);

  document.getElementById("sCount").textContent = log.length;
  document.getElementById("sEarn").textContent  = "$" + totalEarn.toFixed(0);
  document.getElementById("sPerHr").textContent =
    totalHours > 0 ? "$" + (totalEarn / totalHours).toFixed(0) : "$0";
  document.getElementById("sPerKm").textContent =
    totalKm > 0 ? "$" + (totalEarn / totalKm).toFixed(2) : "$0";

  // Best zones — "right now" highlight + per-day breakdown.
  renderBestZonesByDay(log);

  // Best/worst restaurants — slice is "same weekday as today, same 2h window
  // as right now, within last N of that weekday". Each card has its own
  // dropdown for N. The top-of-Stats range filter does NOT apply here.
  renderRestaurantsForSlot("best");
  renderRestaurantsForSlot("worst");

  // Best hour by day — "right now" highlight + per-day breakdown.
  renderBestHoursByDay(log);
}

/* "Best zones by day" card.
 * - Top row (highlighted): best zone for the current day-of-week + current 2h
 *   window. This is the "where should I be RIGHT NOW" answer.
 * - Below: 7 rows, one per day of week, each showing the best (window, zone)
 *   pick for that day overall. */
function renderBestZonesByDay(log) {
  const buckets = bucketizeByZone(log);

  const now    = new Date();
  const curDow = now.getDay();
  const curWs  = windowStartFor(decimalHour(now));

  // Right-now slot
  const nowBest = pickBest(buckets.filter(b => b.dow === curDow && b.ws === curWs));

  // Best per day of week
  const perDayBest = {};
  DAY_DISPLAY_ORDER.forEach(dow => {
    const best = pickBest(buckets.filter(b => b.dow === dow));
    if (best) perDayBest[dow] = best;
  });

  const ul = document.getElementById("bestZones");
  ul.innerHTML = "";

  // Highlighted "right now" row
  ul.appendChild(buildNowLi({
    title: `Right now · ${DAY_SHORT[curDow]} ${fmtWindowRange(curWs)}`,
    bucket: nowBest,
    detailsForBucket: b => `${escapeHtml(b.zone)} · ${b.count} order${b.count===1?"":"s"} · $${b.earn.toFixed(0)} total`,
    emptyMsg: "No data yet for this slot — log a few deliveries."
  }));

  // Per-day rows
  DAY_DISPLAY_ORDER.forEach(dow => {
    const o = perDayBest[dow];
    const li = document.createElement("li");
    if (o) {
      li.innerHTML = `
        <div>
          <div class="name">${DAY_SHORT[dow]} · ${fmtWindowRange(o.ws)} · ${escapeHtml(o.zone)}</div>
          <div class="sub">${o.count} order${o.count===1?"":"s"} · $${o.earn.toFixed(0)} total</div>
        </div>
        <div class="val">$${o.perHr.toFixed(0)} $/hr</div>
      `;
    } else {
      li.innerHTML = `
        <div>
          <div class="name">${DAY_SHORT[dow]}</div>
          <div class="sub muted">No data yet.</div>
        </div>
        <div class="val muted">—</div>
      `;
    }
    ul.appendChild(li);
  });
}

/* "Best hour by day" card.
 * - Top row (highlighted): the user's $/hr for the current day-of-week + the
 *   current hour-of-day, across all logged deliveries.
 * - Below: 7 rows, one per day of week, each showing the single best
 *   hour-of-day for that day. */
function renderBestHoursByDay(log) {
  const buckets = bucketizeByHour(log);

  const now     = new Date();
  const curDow  = now.getDay();
  const curHour = now.getHours();

  const nowBest = pickBest(buckets.filter(b => b.dow === curDow && b.hour === curHour));

  const perDayBest = {};
  DAY_DISPLAY_ORDER.forEach(dow => {
    const best = pickBest(buckets.filter(b => b.dow === dow));
    if (best) perDayBest[dow] = best;
  });

  const ul = document.getElementById("bestHours");
  ul.innerHTML = "";

  ul.appendChild(buildNowLi({
    title: `Right now · ${DAY_SHORT[curDow]} ${fmtHour12(curHour)}`,
    bucket: nowBest,
    detailsForBucket: b => `${b.count} order${b.count===1?"":"s"} · $${b.earn.toFixed(0)} total`,
    emptyMsg: "No data yet for this hour — log a few deliveries."
  }));

  DAY_DISPLAY_ORDER.forEach(dow => {
    const o = perDayBest[dow];
    const li = document.createElement("li");
    if (o) {
      li.innerHTML = `
        <div>
          <div class="name">${DAY_SHORT[dow]} · ${fmtHour12(o.hour)}</div>
          <div class="sub">${o.count} order${o.count===1?"":"s"} · $${o.earn.toFixed(0)} total</div>
        </div>
        <div class="val">$${o.perHr.toFixed(0)} $/hr</div>
      `;
    } else {
      li.innerHTML = `
        <div>
          <div class="name">${DAY_SHORT[dow]}</div>
          <div class="sub muted">No data yet.</div>
        </div>
        <div class="val muted">—</div>
      `;
    }
    ul.appendChild(li);
  });
}

/* Build the highlighted "right now" <li> used at the top of bestZones /
 * bestHours rank cards. */
function buildNowLi({ title, bucket, detailsForBucket, emptyMsg }) {
  const li = document.createElement("li");
  li.className = "now";
  if (bucket) {
    li.innerHTML = `
      <div>
        <div class="name">${escapeHtml(title)}</div>
        <div class="sub">${detailsForBucket(bucket)}</div>
      </div>
      <div class="val">$${bucket.perHr.toFixed(0)} $/hr</div>
    `;
  } else {
    li.innerHTML = `
      <div>
        <div class="name">${escapeHtml(title)}</div>
        <div class="sub muted">${escapeHtml(emptyMsg)}</div>
      </div>
      <div class="val muted">—</div>
    `;
  }
  return li;
}

/* ---------- Generic restaurant aggregation (kept for best/worst restaurants) */
function aggregate(log, key) {
  const map = {};
  log.forEach(e => {
    const k = e[key] || "Unknown";
    if (!map[k]) {
      map[k] = { name: k, earn: 0, min: 0, count: 0, km: 0, hourSet: new Set() };
    }
    const o = map[k];
    o.earn += e.pay + e.tip;
    o.min  += e.min;
    o.km   += e.km;
    o.count++;
    // Track distinct (date, hour) pairs so $/hr is real clock-hours, not
    // extrapolated from delivery minutes.
    const d = new Date(e.ts);
    o.hourSet.add(`${d.toDateString()}|${d.getHours()}`);
  });
  Object.values(map).forEach(o => { o.hours = o.hourSet.size; });
  return map;
}

function topByPerHr(map) {
  return Object.values(map)
    .map(o => ({ ...o, perHr: o.hours > 0 ? o.earn / o.hours : 0 }))
    .filter(o => o.count >= 1)
    .sort((a, b) => b.perHr - a.perHr)
    .slice(0, 5);
}

/* ---------- Best/worst restaurants for current weekday + 2h block ---------- */

/* Cutoff timestamp for "include only the last N occurrences of today's
 * weekday, counting today as the 1st". lastN === "all" → no cutoff.
 * Example: today is Mon, lastN = 4 → cutoff is start-of-day 3 weeks ago. */
function cutoffForLastNWeekdays(lastN) {
  if (lastN === "all") return -Infinity;
  const n = parseInt(lastN, 10);
  if (!n || n < 1) return -Infinity;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (n - 1) * 7);
  return d.getTime();
}

/* Filter the log to entries that:
 *   1. fall on today's weekday (e.g. only Mondays if today is Mon),
 *   2. fall inside the current fixed 2-hour block (0-2, 2-4, ... 22-24,
 *      determined by Math.floor(currentHour / 2) * 2),
 *   3. are within the last N occurrences of that weekday (or all-time). */
function filterByWeekdayAndBlock(log, lastN) {
  const now = new Date();
  const weekday = now.getDay();
  const blockStart = windowStartFor(now.getHours());
  const blockEnd = blockStart + WINDOW_SIZE_HOURS;
  const cutoff = cutoffForLastNWeekdays(lastN);
  return log.filter(e => {
    const d = new Date(e.ts);
    if (d.getTime() < cutoff) return false;
    if (d.getDay() !== weekday) return false;
    const h = d.getHours();
    return h >= blockStart && h < blockEnd;
  });
}

/* Render the Best (or Worst) restaurants card.
 * Slice = today's weekday + current 2h block + last N (from this card's own
 * dropdown). Best = top 5 by total earnings. Worst = bottom 5 by total
 * earnings, with count>=2 to avoid one-off bad luck dominating. */
function renderRestaurantsForSlot(mode) {
  const isBest    = mode === "best";
  const selId     = isBest ? "bestRestRange"   : "worstRestRange";
  const ulId      = isBest ? "bestRestaurants" : "worstRestaurants";
  const titleId   = isBest ? "bestRestTitle"   : "worstRestTitle";
  const sel       = document.getElementById(selId);
  const lastN     = sel ? sel.value : "4";

  const slice = filterByWeekdayAndBlock(loadLog(), lastN);
  const map   = aggregate(slice, "restaurant");

  // Title shows the active slice so it's obvious what's being ranked.
  const now    = new Date();
  const dayStr = DAY_SHORT[now.getDay()];
  const winStr = fmtWindowRange(windowStartFor(now.getHours()));
  const scope  = lastN === "all"
    ? `all-time ${DAY_FULL[now.getDay()]}s`
    : `last ${lastN} ${DAY_FULL[now.getDay()]}${parseInt(lastN, 10) === 1 ? "" : "s"}`;
  const titleEl = document.getElementById(titleId);
  if (titleEl) {
    titleEl.textContent = `${isBest ? "Best" : "Worst"} restaurants · ${dayStr} ${winStr} · ${scope}`;
  }

  // Rank by total $ earned in this slice (not $/hr).
  let ranked = Object.values(map).map(o => ({
    ...o,
    perHr: o.hours > 0 ? o.earn / o.hours : 0
  }));
  if (isBest) {
    ranked = ranked.sort((a, b) => b.earn - a.earn).slice(0, 5);
  } else {
    // Drop one-off restaurants so a single bad order doesn't dominate.
    ranked = ranked
      .filter(r => r.count >= 2)
      .sort((a, b) => a.earn - b.earn)
      .slice(0, 5);
  }
  renderRankByEarn(ulId, ranked);
}

/* Like renderRank, but the headline number is total $ earned in the slice
 * and the subtitle shows order count + $/hr context. */
function renderRankByEarn(elId, items) {
  const ul = document.getElementById(elId);
  ul.innerHTML = "";
  if (!items.length) {
    ul.innerHTML = `<li class="muted small">No history yet for this slot — log a few deliveries.</li>`;
    return;
  }
  items.forEach(o => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <div class="name">${escapeHtml(o.name)}</div>
        <div class="sub">${o.count} order${o.count===1?"":"s"} · $${o.perHr.toFixed(0)}/hr</div>
      </div>
      <div class="val">$${o.earn.toFixed(0)}</div>
    `;
    ul.appendChild(li);
  });
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
document.getElementById("bestRestRange").addEventListener("change", () => renderRestaurantsForSlot("best"));
document.getElementById("worstRestRange").addEventListener("change", () => renderRestaurantsForSlot("worst"));

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
// Tick the clock every 30s. Also re-render the best/worst restaurant cards
// while the Stats tab is open so they auto-roll when the clock crosses into
// the next 2h block (e.g. 3:59 → 4:00 pm flips from the 2-4 slice to 4-6).
setInterval(() => {
  if (document.getElementById("tab-now").classList.contains("active")) renderNow();
  if (document.getElementById("tab-stats").classList.contains("active")) {
    renderRestaurantsForSlot("best");
    renderRestaurantsForSlot("worst");
  }
}, 30000);

/* ---------- Service worker registration (PWA install) ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
