const STORAGE_KEY = "jw-helper-fieldservice-availability";
const ASSIGNMENTS_KEY = "jw-helper-fieldservice-assignments";
const WEEKDAY_BLOCKS_KEY = "jw-helper-fieldservice-weekday-blocks";
const DAY_NAMES = ["P", "E", "T", "K", "N", "R", "L"];
const DAY_LABELS = {
  1: "Esmaspäev",
  3: "Kolmapäev",
  6: "Laupäev",
};
const MEETING_DAYS = [1, 3, 6];

const listEl = document.getElementById("people-list");
const upcomingEl = document.getElementById("upcoming-meetings");
const peopleCountEl = document.getElementById("people-count");
const scheduleMonthEl = document.getElementById("schedule-month");
const planOutputEl = document.getElementById("plan-output");
const generatePlanEl = document.getElementById("generate-plan");

let people = [];
let availability = {};
let weekdayBlocks = {};
let assignmentCounts = {};
let currentPlan = null;
let expandedPerson = null;
let selectedMonth = "";

function personKey(name) {
  return name.trim().toLowerCase();
}

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(dateStr) {
  return parseDate(dateStr).toLocaleDateString("et-EE", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateShort(dateStr) {
  return parseDate(dateStr).toLocaleDateString("et-EE", { day: "numeric", month: "short" });
}

function formatDateNumeric(dateStr) {
  const date = parseDate(dateStr);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthName(dateStr) {
  return parseDate(dateStr).toLocaleDateString("et-EE", { month: "long" }).toLowerCase();
}

function formatMonthValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getInitials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function loadAvailability() {
  try {
    availability = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    availability = {};
  }
}

function saveAvailability() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(availability));
}

function loadAssignmentCounts() {
  try {
    assignmentCounts = JSON.parse(localStorage.getItem(ASSIGNMENTS_KEY) || "{}");
  } catch {
    assignmentCounts = {};
  }
}

function saveAssignmentCounts() {
  localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignmentCounts));
}

function loadWeekdayBlocks() {
  try {
    weekdayBlocks = JSON.parse(localStorage.getItem(WEEKDAY_BLOCKS_KEY) || "{}");
  } catch {
    weekdayBlocks = {};
  }
}

function saveWeekdayBlocks() {
  localStorage.setItem(WEEKDAY_BLOCKS_KEY, JSON.stringify(weekdayBlocks));
}

function getAssignmentCount(name) {
  return assignmentCounts[personKey(name)] ?? 0;
}

function getUnavailableRanges(name) {
  return availability[personKey(name)] ?? [];
}

function getBlockedWeekdays(name) {
  return weekdayBlocks[personKey(name)] ?? [];
}

function isUnavailableOnDate(name, dateStr) {
  const date = parseDate(dateStr);
  const day = date.getDay();
  return (
    getUnavailableRanges(name).some((range) => date >= parseDate(range.start) && date <= parseDate(range.end)) ||
    getBlockedWeekdays(name).includes(day)
  );
}

function addUnavailable(name, start, end) {
  const key = personKey(name);
  const ranges = getUnavailableRanges(name);
  if (parseDate(start) > parseDate(end)) [start, end] = [end, start];
  ranges.push({ start, end });
  ranges.sort((a, b) => a.start.localeCompare(b.start));
  availability[key] = ranges;
  saveAvailability();
}

function removeUnavailable(name, index) {
  const key = personKey(name);
  const ranges = getUnavailableRanges(name);
  ranges.splice(index, 1);
  if (ranges.length === 0) delete availability[key];
  else availability[key] = ranges;
  saveAvailability();
}

function addBlockedWeekday(name, weekday) {
  const key = personKey(name);
  const days = new Set(getBlockedWeekdays(name));
  days.add(Number(weekday));
  weekdayBlocks[key] = Array.from(days).sort((a, b) => a - b);
  saveWeekdayBlocks();
}

function removeBlockedWeekday(name, weekday) {
  const key = personKey(name);
  const days = getBlockedWeekdays(name).filter((d) => d !== Number(weekday));
  if (days.length === 0) delete weekdayBlocks[key];
  else weekdayBlocks[key] = days;
  saveWeekdayBlocks();
}

function getMeetingTime(dayOfWeek) {
  return dayOfWeek === 6 ? "10:30" : "18:00";
}

function getUpcomingMeetings() {
  const meetings = [];
  const cursor = selectedMonth ? new Date(`${selectedMonth}-01T00:00:00`) : new Date();
  if (Number.isNaN(cursor.getTime())) cursor.setTime(Date.now());
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  const month = cursor.getMonth();
  const year = cursor.getFullYear();

  while (cursor.getFullYear() === year && cursor.getMonth() === month) {
    if (MEETING_DAYS.includes(cursor.getDay())) {
      meetings.push({
        date: toDateString(cursor),
        dayOfWeek: cursor.getDay(),
        label: DAY_LABELS[cursor.getDay()],
        isZoom: cursor.getDay() === 3,
        time: getMeetingTime(cursor.getDay()),
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return meetings;
}

function formatDayLetter(dateStr) {
  return DAY_NAMES[parseDate(dateStr).getDay()];
}

function formatAvailabilitySummary(name) {
  const ranges = getUnavailableRanges(name);
  return ranges
    .map((range) => (range.start === range.end ? formatDate(range.start) : `${formatDate(range.start)} - ${formatDate(range.end)}`))
    .join(" · ");
}

function formatWhatsAppText(plan) {
  const monthName = formatMonthName(plan[0]?.meeting?.date ?? toDateString(new Date()));
  const lines = [`Kuulutustöökoosoleku graafik – ${monthName}`, ""];

  for (const entry of plan) {
    const { meeting, assignee } = entry;
    const location = meeting.isZoom ? "Zoomis" : "Saalis";
    lines.push(`${formatDateNumeric(meeting.date)} (${formatDayLetter(meeting.date)}) — ${meeting.time} ${location}; ${assignee ?? "Keegi pole saadaval"}`);
  }

  return lines.join("\n").trim();
}

function generateFairPlan() {
  const meetings = getUpcomingMeetings();
  const plan = [];
  const planCounts = {};
  const randomBias = Object.fromEntries(people.map((person) => [personKey(person.name), Math.random()]));

  for (const meeting of meetings) {
    const available = people.filter((p) => !isUnavailableOnDate(p.name, meeting.date));

    if (available.length === 0) {
      plan.push({ meeting, assignee: null });
      continue;
    }

    const ranked = available.map((person) => {
      const key = personKey(person.name);
      return {
        person,
        total: getAssignmentCount(person.name) + (planCounts[key] ?? 0),
        bias: randomBias[key] ?? Math.random(),
      };
    });

    const lowestTotal = Math.min(...ranked.map((item) => item.total));
    let pool = ranked.filter((item) => item.total === lowestTotal).map((item) => item.person);

    pool.sort((a, b) => {
      const biasA = randomBias[personKey(a.name)] ?? 0;
      const biasB = randomBias[personKey(b.name)] ?? 0;
      if (biasA !== biasB) return biasA - biasB;
      return a.name.localeCompare(b.name, "et");
    });

    const chosen = pool[0];
    const key = personKey(chosen.name);
    planCounts[key] = (planCounts[key] ?? 0) + 1;
    plan.push({ meeting, assignee: chosen.name });
  }

  return plan;
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderPlan() {
  if (!currentPlan || currentPlan.length === 0) {
    planOutputEl.className = "plan-output plan-output--empty";
    planOutputEl.innerHTML = '<p class="plan-placeholder">Vajuta „Koosta plaan“, et luua jaotus.</p>';
    return;
  }

  const whatsappText = formatWhatsAppText(currentPlan);
  planOutputEl.className = "plan-output";
  planOutputEl.innerHTML = `
    <ul class="plan-list">
      ${currentPlan
        .map(({ meeting, assignee }) => `
          <li class="plan-item${assignee ? "" : " plan-item--warning"}">
            <div class="plan-item__date-block">
              <div class="plan-item__day">${formatDayLetter(meeting.date)}</div>
              <div class="plan-item__date">${formatDateShort(meeting.date)}</div>
            </div>
            <div class="plan-item__details">
              <div class="plan-item__label">${meeting.label}${meeting.isZoom ? ' <span class="zoom-tag">Zoom</span>' : ""}</div>
              ${assignee ? `<div class="plan-item__assignee">${assignee}</div>` : `<div class="plan-item__assignee plan-item__assignee--missing">Keegi pole saadaval</div>`}
            </div>
          </li>`)
        .join("")}
    </ul>
    <div class="plan-preview">
      <p class="plan-preview__label">WhatsAppi eelvaade</p>
      <pre class="plan-preview__text">${escapeHtml(whatsappText)}</pre>
      <div class="plan-preview__actions">
        <button type="button" class="btn btn--ghost" id="copy-whatsapp">Kopeeri WhatsAppi</button>
      </div>
    </div>
  `;

  planOutputEl.querySelector("#copy-whatsapp").addEventListener("click", copyPlanToClipboard);
}

function showToast(message) {
  let toast = document.getElementById("plan-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "plan-toast";
    toast.className = "plan-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("plan-toast--visible");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove("plan-toast--visible"), 2500);
}

async function copyPlanToClipboard() {
  if (!currentPlan) return;

  try {
    await navigator.clipboard.writeText(formatWhatsAppText(currentPlan));
    showToast("Kopeeritud! Kleebi WhatsAppi.");
  } catch {
    const pre = planOutputEl.querySelector(".plan-preview__text");
    if (pre) {
      const range = document.createRange();
      range.selectNodeContents(pre);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      showToast("Tekst valitud - kasuta Ctrl+C");
    }
  }
}

function renderUpcomingMeetings() {
  const meetings = getUpcomingMeetings();
  upcomingEl.innerHTML = "";

  for (const meeting of meetings) {
    const available = people.filter((p) => !isUnavailableOnDate(p.name, meeting.date)).length;
    const card = document.createElement("article");
    card.className = "meeting-card";
    const dateObj = parseDate(meeting.date);
    const zoomTag = meeting.isZoom ? '<span class="zoom-tag">Zoom</span>' : "";
    card.innerHTML = `
      <div class="meeting-card__day">${DAY_NAMES[dateObj.getDay()]}</div>
      <div class="meeting-card__date">${formatDateShort(meeting.date)}</div>
      <div class="meeting-card__label">${meeting.label}${zoomTag ? ` ${zoomTag}` : ""}</div>
      <div class="meeting-card__count">${available} / ${people.length} saadaval</div>
    `;
    upcomingEl.appendChild(card);
  }
}

function renderAdminPanel(name) {
  const ranges = getUnavailableRanges(name);
  const blocked = getBlockedWeekdays(name);
  const key = personKey(name);

  const rangesHtml = ranges.length === 0
    ? '<p class="admin-empty">Puuduvaid päevi pole märgitud.</p>'
    : `<ul class="range-list">
        ${ranges.map((range, i) => `
          <li class="range-item">
            <span>${range.start === range.end ? formatDate(range.start) : `${formatDate(range.start)} - ${formatDate(range.end)}`}</span>
            <button type="button" class="btn btn--danger btn--sm" data-action="remove-range" data-person="${key}" data-index="${i}">Eemalda</button>
          </li>`).join("")}
      </ul>`;

  const blockedHtml = blocked.length === 0
    ? '<p class="admin-empty">Korduvaid nädalapäevi pole märgitud.</p>'
    : `<ul class="range-list">
        ${blocked.map((day) => `
          <li class="range-item">
            <span>${DAY_LABELS[day]}</span>
            <button type="button" class="btn btn--danger btn--sm" data-action="remove-weekday" data-person="${key}" data-weekday="${day}">Eemalda</button>
          </li>`).join("")}
      </ul>`;

  return `
    <div class="admin-panel">
      <p class="admin-panel__intro">Siin saad märkida vendadele puudumised kuupäevade, vahemike ja korduvate nädalapäevade kaupa.</p>
      <div class="admin-form">
        <div class="admin-form__group">
          <label>Lisa üks päev</label>
          <div class="admin-form__row">
            <input type="date" class="input" data-role="single-date" data-person="${key}">
            <button type="button" class="btn btn--primary btn--sm" data-action="add-day" data-person="${key}">Lisa</button>
          </div>
        </div>
        <div class="admin-form__group">
          <label>Lisa vahemik</label>
          <div class="admin-form__row admin-form__row--range">
            <input type="date" class="input" data-role="range-start" data-person="${key}" aria-label="Algus">
            <span class="range-sep">-</span>
            <input type="date" class="input" data-role="range-end" data-person="${key}" aria-label="Lõpp">
            <button type="button" class="btn btn--primary btn--sm" data-action="add-range" data-person="${key}">Lisa</button>
          </div>
        </div>
        <div class="admin-form__group">
          <label>Korduvad nädalapäevad</label>
          <div class="weekday-list weekday-list--compact">
            ${MEETING_DAYS.map((day) => `
              <label class="weekday-check">
                <input type="checkbox" data-action="toggle-weekday" data-person="${key}" data-weekday="${day}" ${blocked.includes(day) ? "checked" : ""}>
                <span>${DAY_LABELS[day]}</span>
              </label>
            `).join("")}
          </div>
        </div>
      </div>
      <div class="admin-ranges">
        <h3 class="admin-ranges__title">Märgitud puudumised</h3>
        ${rangesHtml}
      </div>
    </div>
  `;
}

function renderPeople() {
  peopleCountEl.textContent = `${people.length} kokku`;
  listEl.innerHTML = "";

  for (const person of people) {
    const key = personKey(person.name);
    const isExpanded = expandedPerson === key;
    const card = document.createElement("article");
    card.className = "person-card";

    card.innerHTML = `
      <div class="person-card__main">
        <div class="avatar" aria-hidden="true">${getInitials(person.name)}</div>
        <div class="person-card__info">
          <h3 class="person-card__name">${person.name}</h3>
          <p class="person-card__availability${getUnavailableRanges(person.name).length > 0 || getBlockedWeekdays(person.name).length > 0 ? "" : " person-card__availability--empty"}">
            ${escapeHtml(formatAvailabilitySummary(person.name))}
          </p>
        </div>
        <button type="button" class="btn btn--ghost btn--sm person-card__toggle" data-action="toggle-edit" data-person="${key}" aria-expanded="${isExpanded}">
          ${isExpanded ? "Sulge" : "Halda"}
        </button>
      </div>
      ${isExpanded ? renderAdminPanel(person.name) : ""}
    `;

    listEl.appendChild(card);
  }
}

function render() {
  renderUpcomingMeetings();
  renderPeople();
}

function handleMonthChange(event) {
  selectedMonth = event.target.value;
  render();
  if (currentPlan) {
    currentPlan = generateFairPlan();
    renderPlan();
  }
}

function findPersonName(key) {
  return people.find((p) => personKey(p.name) === key)?.name;
}

function handleListClick(event) {
  const btn = event.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const key = btn.dataset.person;
  const name = findPersonName(key);
  if (!name) return;

  if (action === "toggle-edit") {
    expandedPerson = expandedPerson === key ? null : key;
    renderPeople();
    return;
  }

  if (action === "remove-range") {
    removeUnavailable(name, Number(btn.dataset.index));
    render();
    if (currentPlan) {
      currentPlan = generateFairPlan();
      renderPlan();
    }
    return;
  }

  if (action === "toggle-weekday") {
    const weekday = Number(btn.dataset.weekday);
    if (btn.checked) {
      addBlockedWeekday(name, weekday);
    } else {
      removeBlockedWeekday(name, weekday);
    }
    render();
    if (currentPlan) {
      currentPlan = generateFairPlan();
      renderPlan();
    }
    return;
  }

  const card = btn.closest(".person-card");

  if (action === "add-day") {
    const input = card.querySelector('[data-role="single-date"]');
    if (!input.value) {
      input.focus();
      return;
    }
    addUnavailable(name, input.value, input.value);
    input.value = "";
    render();
    if (currentPlan) {
      currentPlan = generateFairPlan();
      renderPlan();
    }
    return;
  }

  if (action === "add-range") {
    const startInput = card.querySelector('[data-role="range-start"]');
    const endInput = card.querySelector('[data-role="range-end"]');
    if (!startInput.value || !endInput.value) {
      (startInput.value ? endInput : startInput).focus();
      return;
    }
    addUnavailable(name, startInput.value, endInput.value);
    startInput.value = "";
    endInput.value = "";
    render();
    if (currentPlan) {
      currentPlan = generateFairPlan();
      renderPlan();
    }
  }
}

async function init() {
  listEl.innerHTML = '<p class="state-message">Laen nimekirja...</p>';

  try {
    const response = await fetch("assets/data/people.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    people = data.people ?? [];

    if (people.length === 0) {
      listEl.innerHTML = '<p class="state-message">Nimekiri on tühi.</p>';
      return;
    }

    loadAvailability();
    loadWeekdayBlocks();
    loadAssignmentCounts();
    selectedMonth = formatMonthValue(new Date());
    scheduleMonthEl.value = selectedMonth;

    generatePlanEl.addEventListener("click", () => {
      currentPlan = generateFairPlan();
      renderPlan();
    });
    scheduleMonthEl.addEventListener("change", handleMonthChange);
    listEl.addEventListener("click", handleListClick);

    render();
  } catch (err) {
    listEl.innerHTML = '<p class="state-message state-message--error">Nimekirja laadimine ebaõnnestus. Ava leht kohaliku serveri kaudu (nt <code>npx serve .</code>).</p>';
    console.error(err);
  }
}

init();
