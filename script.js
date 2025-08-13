/***********************
 * Utilities & State
 ***********************/

// Unique ID closure (persists lastId)
const getUniqueId = (() => {
  let id = Number(localStorage.getItem("lastId")) || 0;
  return () => {
    id += 1;
    localStorage.setItem("lastId", String(id));
    return id;
  };
})();

// State
let events = JSON.parse(localStorage.getItem("events") || "[]"); // [{id,title,date,time,category}]
let selectedDateISO = null; // YYYY-MM-DD
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth(); // 0-11

// DOM
const calendarGrid = document.getElementById("calendarGrid");
const currentMonthLabel = document.getElementById("currentMonthLabel");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const todayBtn = document.getElementById("todayBtn");
const eventsForLabel = document.getElementById("eventsForLabel");

const eventList = document.getElementById("eventList");
const upcomingList = document.getElementById("upcomingList");

const drawer = document.getElementById("drawer");
const eventForm = document.getElementById("eventForm");
const titleInput = document.getElementById("title");
const dateInput = document.getElementById("date");
const timeInput = document.getElementById("time");
const categoryInput = document.getElementById("category");
const editIdInput = document.getElementById("editId");
const cancelBtn = document.getElementById("cancelBtn");
const openAddPanelBtn = document.getElementById("openAddPanel");

const showAllBtn = document.getElementById("showAllBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");

const searchInput = document.getElementById("searchInput");
const toast = document.getElementById("toast");
const toggleThemeBtn = document.getElementById("toggleTheme");

// Theme init
(function initTheme() {
  const saved = localStorage.getItem("theme") || "dark";
  if (saved === "light") document.documentElement.classList.add("light");
})();

/***********************
 * Helpers
 ***********************/
const fmtDate = (dateObj) =>
  dateObj.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

const toISODate = (d) => d.toISOString().split("T")[0];

function dateFromISO(iso, time = "00:00") {
  // Construct Date from "YYYY-MM-DD" and "HH:MM"
  return new Date(`${iso}T${time}`);
}

function relativeTimeFrom(date) {
  const now = new Date();
  const diffMs = date - now;
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 60 * 1000) return rtf.format(Math.round(diffMs / 1000), "second");
  if (abs < 60 * 60 * 1000) return rtf.format(Math.round(diffMs / (60 * 1000)), "minute");
  if (abs < 24 * 60 * 60 * 1000) return rtf.format(Math.round(diffMs / (60 * 60 * 1000)), "hour");
  return rtf.format(Math.round(diffMs / (24 * 60 * 60 * 1000)), "day");
}

function saveEvents() {
  localStorage.setItem("events", JSON.stringify(events));
}

function showToast(msg) {
  toast.textContent = msg;
  toast.style.display = "block";
  setTimeout(() => (toast.style.display = "none"), 1700);
}

/***********************
 * Calendar Rendering
 ***********************/
function rebuildCalendar() {
  // Header label
  const first = new Date(viewYear, viewMonth, 1);
  currentMonthLabel.textContent = first.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });

  // Compute days grid
  calendarGrid.innerHTML = "";
  const startDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Leading blanks
  for (let i = 0; i < startDay; i++) {
    const cell = document.createElement("div");
    cell.className = "day";
    calendarGrid.appendChild(cell);
  }

  const todayISO = toISODate(new Date());

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    cell.className = "day";
    const iso = toISODate(new Date(viewYear, viewMonth, day));
    if (iso === todayISO) cell.classList.add("today");
    if (selectedDateISO === iso) cell.classList.add("selected");

    // Badge
    const badge = document.createElement("div");
    badge.className = "date-badge";
    badge.textContent = day;

    // Dots for categories that exist that day
    const dots = document.createElement("div");
    dots.className = "dots";
    const dayEvents = events.filter((ev) => ev.date === iso);
    const catSet = new Set(dayEvents.map((e) => e.category.toLowerCase()));
    catSet.forEach((c) => {
      const d = document.createElement("span");
      d.className = "dot " + (c === "urgent" ? "urgent" : c === "work" ? "work" : c === "personal" ? "personal" : "general");
      dots.appendChild(d);
    });

    cell.appendChild(badge);
    cell.appendChild(dots);

    cell.addEventListener("click", () => {
      selectedDateISO = iso;
      eventsForLabel.textContent = `Events for ${fmtDate(new Date(iso))}`;
      rebuildCalendar();
      renderEvents();
    });

    calendarGrid.appendChild(cell);
  }
}

/***********************
 * Events Rendering
 ***********************/
function renderEvents() {
  // Filter by selected date + search
  const term = (searchInput.value || "").toLowerCase().trim();
  let list = [...events];

  if (selectedDateISO) list = list.filter((ev) => ev.date === selectedDateISO);
  if (term) list = list.filter((ev) => ev.title.toLowerCase().includes(term));

  // Sort by datetime
  list.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

  eventList.innerHTML = "";
  if (list.length === 0) {
    const empty = document.createElement("li");
    empty.className = "meta";
    empty.style.padding = "10px";
    empty.textContent = "No events.";
    eventList.appendChild(empty);
  } else {
    list.forEach((ev) => {
      const li = document.createElement("li");
      li.className = "event";

      const when = new Date(`${ev.date}T${ev.time}`);
      const now = new Date();
      const badges = [];

      if (toISODate(when) === toISODate(now)) badges.push('<span class="badge today">Today</span>');
      if (when < now) badges.push('<span class="badge past">Past</span>');
      if (when > now) badges.push('<span class="badge upcoming">Upcoming</span>');

      const left = document.createElement("div");
      left.innerHTML = `
        <div class="title">${escapeHtml(ev.title)}</div>
        <div class="meta">
          ${fmtDate(new Date(ev.date))} • ${ev.time} • ${ev.category}
          <span class="meta"> • ${relativeTimeFrom(when)}</span>
        </div>
        <div class="badges">${badges.join(" ")}</div>
      `;

      const right = document.createElement("div");
      right.className = "row-actions";
      const editBtn = document.createElement("button");
      editBtn.className = "action";
      editBtn.textContent = "Edit";
      editBtn.onclick = () => startEdit(ev.id);

      const delBtn = document.createElement("button");
      delBtn.className = "action danger";
      delBtn.textContent = "Delete";
      delBtn.onclick = () => deleteEvent(ev.id);

      right.appendChild(editBtn);
      right.appendChild(delBtn);

      li.appendChild(left);
      li.appendChild(right);
      eventList.appendChild(li);
    });
  }

  renderUpcoming();
}

/***********************
 * CRUD & Validation
 ***********************/
function validate({ title, date, time }) {
  if (!title || !title.trim()) return "Title is required.";
  if (!date) return "Date is required.";
  if (!time) return "Time is required.";
  const dt = dateFromISO(date, time);
  if (isNaN(dt.getTime())) return "Invalid date/time.";
  return null;
}

function startEdit(id) {
  const ev = events.find((e) => e.id === id);
  if (!ev) return;
  editIdInput.value = String(ev.id);
  titleInput.value = ev.title;
  dateInput.value = ev.date;
  timeInput.value = ev.time;
  categoryInput.value = ev.category || "General";
  drawerScrollFocus();
}

function deleteEvent(id) {
  events = events.filter((e) => e.id !== id);
  saveEvents();
  showToast("Event deleted");
  rebuildCalendar();
  renderEvents();
}

eventForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const payload = {
    id: editIdInput.value ? Number(editIdInput.value) : getUniqueId(),
    title: titleInput.value.trim(),
    date: dateInput.value,
    time: timeInput.value,
    category: categoryInput.value || "General",
  };

  const error = validate(payload);
  if (error) {
    showToast(error);
    return;
  }

  const idx = events.findIndex((x) => x.id === payload.id);
  if (idx >= 0) {
    events[idx] = payload;
    showToast("Event updated");
  } else {
    events.push(payload);
    scheduleAlert(payload);
    showToast("Event added");
  }

  saveEvents();
  rebuildCalendar();
  renderEvents();
  eventForm.reset();
  editIdInput.value = "";
});

cancelBtn.addEventListener("click", () => {
  eventForm.reset();
  editIdInput.value = "";
});

openAddPanelBtn.addEventListener("click", () => {
  // Prefill selected date if any
  if (selectedDateISO) dateInput.value = selectedDateISO;
  drawerScrollFocus();
});

function drawerScrollFocus() {
  // Ensure inputs are visible/focused (no modal, so focus is enough)
  titleInput.focus();
}

/***********************
 * Filtering & Search
 ***********************/
showAllBtn.addEventListener("click", () => {
  selectedDateISO = null;
  eventsForLabel.textContent = "All Events";
  rebuildCalendar();
  renderEvents();
});

searchInput.addEventListener("input", renderEvents);

/***********************
 * Import / Export / Clear
 ***********************/
exportBtn.addEventListener("click", () => {
  const data = JSON.stringify(events, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "events.json";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Exported");
});

importFile.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error("Invalid format");
      // Normalize + assign IDs if missing
      imported.forEach((obj) => {
        if (!obj.id) obj.id = getUniqueId();
        if (!obj.category) obj.category = "General";
      });
      events = [...events, ...imported];
      saveEvents();
      rebuildCalendar();
      renderEvents();
      showToast("Imported");
    } catch {
      showToast("Import failed");
    }
  };
  reader.readAsText(file);
});

clearAllBtn.addEventListener("click", () => {
  if (!confirm("Delete all events?")) return;
  events = [];
  saveEvents();
  showToast("All cleared");
  rebuildCalendar();
  renderEvents();
});

/***********************
 * Upcoming (next 3)
 ***********************/
function renderUpcoming() {
  const now = new Date();
  const upcoming = events
    .filter((e) => new Date(`${e.date}T${e.time}`) > now)
    .sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`))
    .slice(0, 3);

  upcomingList.innerHTML = "";
  if (upcoming.length === 0) {
    const li = document.createElement("li");
    li.className = "meta";
    li.style.padding = "8px";
    li.textContent = "No upcoming events.";
    upcomingList.appendChild(li);
    return;
  }

  upcoming.forEach((ev) => {
    const li = document.createElement("li");
    const when = new Date(`${ev.date}T${ev.time}`);
    li.textContent = `${ev.title} • ${ev.time} • ${relativeTimeFrom(when)}`;
    upcomingList.appendChild(li);
  });
}

/***********************
 * Alerts (within 60 min)
 * - schedules new on add
 * - reschedules all on page load
 ***********************/
function scheduleAlert(ev) {
  const when = new Date(`${ev.date}T${ev.time}`).getTime();
  const now = Date.now();
  const diff = when - now;
  if (diff > 0 && diff <= 60 * 60 * 1000) {
    setTimeout(() => {
      // Use toast (non-blocking) instead of alert()
      showToast(`🔔 Upcoming: "${ev.title}" at ${ev.time}`);
      beep();
    }, diff);
  }
}

function rescheduleAllAlerts() {
  const now = Date.now();
  events.forEach((ev) => {
    const when = new Date(`${ev.date}T${ev.time}`).getTime();
    const diff = when - now;
    if (diff > 0 && diff <= 60 * 60 * 1000) {
      scheduleAlert(ev);
    }
  });
}

/***********************
 * Sound (no external files)
 ***********************/
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
    o.start();
    setTimeout(() => {
      g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.15);
      setTimeout(() => { o.stop(); ctx.close(); }, 160);
    }, 120);
  } catch { /* ignore */ }
}

/***********************
 * Month navigation
 ***********************/
prevMonthBtn.addEventListener("click", () => {
  if (viewMonth === 0) {
    viewMonth = 11;
    viewYear -= 1;
  } else {
    viewMonth -= 1;
  }
  rebuildCalendar();
});

nextMonthBtn.addEventListener("click", () => {
  if (viewMonth === 11) {
    viewMonth = 0;
    viewYear += 1;
  } else {
    viewMonth += 1;
  }
  rebuildCalendar();
});

todayBtn.addEventListener("click", () => {
  const d = new Date();
  viewYear = d.getFullYear();
  viewMonth = d.getMonth();
  selectedDateISO = toISODate(d);
  eventsForLabel.textContent = `Events for ${fmtDate(d)}`;
  rebuildCalendar();
  renderEvents();
});

/***********************
 * Theme toggle
 ***********************/
toggleThemeBtn.addEventListener("click", () => {
  document.documentElement.classList.toggle("light");
  const isLight = document.documentElement.classList.contains("light");
  localStorage.setItem("theme", isLight ? "light" : "dark");
});

/***********************
 * Secure text
 ***********************/
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]
  ));
}

/***********************
 * Init
 ***********************/
(function init() {
  // If there are no events, selected label = All
  eventsForLabel.textContent = "All Events";
  // Pre-fill form date with today
  dateInput.value = toISODate(new Date());
  rebuildCalendar();
  renderEvents();
  rescheduleAllAlerts();
})();
