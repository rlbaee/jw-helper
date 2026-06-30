const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const PEOPLE_FILE = path.join(__dirname, 'data', 'people.json');
const SCHEDULES_FILE = path.join(__dirname, 'data', 'schedules.json');

const ROLES = ["Heli", "U.teenind.", "S.teenind.", "Lugeja", "Juhataja", "mikr.1+lava", "mikr.2"];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- storage helpers ----------

function readJson(file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

function readPeople() {
  return readJson(PEOPLE_FILE, { people: [] });
}

function writePeople(db) {
  writeJson(PEOPLE_FILE, db);
}

function readSchedules() {
  return readJson(SCHEDULES_FILE, { schedules: {} });
}

function writeSchedules(db) {
  writeJson(SCHEDULES_FILE, db);
}

function nextId(people) {
  return people.length ? Math.max(...people.map(p => p.id)) + 1 : 1;
}

// ---------- people API ----------

app.get('/api/people', (req, res) => {
  res.json(readPeople());
});

app.get('/api/roles', (req, res) => {
  res.json({ roles: ROLES });
});

app.post('/api/people', (req, res) => {
  const { full_name, short_name, roles } = req.body;
  if (!full_name || !Array.isArray(roles) || roles.length === 0) {
    return res.status(400).json({ error: 'full_name ja vähemalt üks roll on kohustuslikud' });
  }
  const db = readPeople();
  const person = {
    id: nextId(db.people),
    full_name: full_name.trim(),
    short_name: (short_name || full_name).trim(),
    roles,
    unavailable_dates: [],
    assignment_counts: {}
  };
  db.people.push(person);
  writePeople(db);
  res.json(person);
});

app.put('/api/people/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const db = readPeople();
  const person = db.people.find(p => p.id === id);
  if (!person) return res.status(404).json({ error: 'Inimest ei leitud' });

  const { full_name, short_name, roles, unavailable_dates } = req.body;
  if (full_name !== undefined) person.full_name = full_name.trim();
  if (short_name !== undefined) person.short_name = short_name.trim();
  if (roles !== undefined) person.roles = roles;
  if (unavailable_dates !== undefined) person.unavailable_dates = unavailable_dates;

  writePeople(db);
  res.json(person);
});

app.delete('/api/people/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const db = readPeople();
  db.people = db.people.filter(p => p.id !== id);
  writePeople(db);
  res.json({ ok: true });
});

// ---------- schedule generation ----------

// Returns array of meeting dates (Date objects) in a given month for given weekdays (0=Sun..6=Sat)
function getMeetingDates(year, month, weekdays) {
  const dates = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    if (weekdays.includes(d.getDay())) {
      dates.push(d);
    }
  }
  return dates;
}

function formatDateISO(d) {
  return d.toISOString().slice(0, 10);
}

function formatDateHuman(d) {
  const days = ['P', 'E', 'T', 'K', 'N', 'R', 'L'];
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} (${days[d.getDay()]})`;
}

// Balanced round-robin assignment per role, respecting unavailability and
// persistent assignment_counts (so balance carries across months).
function generateSchedule(year, month, weekdays) {
  const db = readPeople();
  const people = db.people;
  const dates = getMeetingDates(year, month, weekdays);

  const table = [];
  // working copy of counts so we balance within this generation run too
  const counts = {};
  people.forEach(p => {
    counts[p.id] = {};
    ROLES.forEach(r => {
      counts[p.id][r] = (p.assignment_counts && p.assignment_counts[r]) || 0;
    });
  });

  const usedTodayByDate = {}; // dateISO -> Set of person ids already assigned that day

  dates.forEach(date => {
    const dateISO = formatDateISO(date);
    usedTodayByDate[dateISO] = new Set();
    const rowAssignments = {};

    ROLES.forEach(role => {
      const candidates = people.filter(p => {
        if (!p.roles.includes(role)) return false;
        if (p.unavailable_dates && p.unavailable_dates.includes(dateISO)) return false;
        if (usedTodayByDate[dateISO].has(p.id)) return false;
        return true;
      });

      if (candidates.length === 0) {
        rowAssignments[role] = null;
        return;
      }

      // pick candidate with lowest count for this role, tie-broken by lowest id
      candidates.sort((a, b) => {
        const diff = counts[a.id][role] - counts[b.id][role];
        if (diff !== 0) return diff;
        return a.id - b.id;
      });
      const chosen = candidates[0];
      rowAssignments[role] = { id: chosen.id, short_name: chosen.short_name };
      counts[chosen.id][role] += 1;
      usedTodayByDate[dateISO].add(chosen.id);
    });

    table.push({
      date: dateISO,
      date_label: formatDateHuman(date),
      assignments: rowAssignments
    });
  });

  return { year, month, weekdays, roles: ROLES, rows: table, working_counts: counts };
}

app.post('/api/schedule/preview', (req, res) => {
  const { year, month, weekdays } = req.body;
  if (!year || !month || !Array.isArray(weekdays) || weekdays.length === 0) {
    return res.status(400).json({ error: 'year, month ja weekdays on kohustuslikud' });
  }
  const result = generateSchedule(year, month, weekdays);
  res.json(result);
});

app.post('/api/schedule/save', (req, res) => {
  const { year, month, weekdays } = req.body;
  if (!year || !month || !Array.isArray(weekdays) || weekdays.length === 0) {
    return res.status(400).json({ error: 'year, month ja weekdays on kohustuslikud' });
  }
  const result = generateSchedule(year, month, weekdays);

  // persist working counts back into people.json so future months stay balanced
  const db = readPeople();
  db.people.forEach(p => {
    if (result.working_counts[p.id]) {
      p.assignment_counts = result.working_counts[p.id];
    }
  });
  writePeople(db);

  // store the schedule itself
  const schedulesDb = readSchedules();
  const key = `${year}-${String(month).padStart(2, '0')}`;
  schedulesDb.schedules[key] = result;
  writeSchedules(schedulesDb);

  res.json(result);
});

app.get('/api/schedule/:year/:month', (req, res) => {
  const key = `${req.params.year}-${String(req.params.month).padStart(2, '0')}`;
  const schedulesDb = readSchedules();
  const schedule = schedulesDb.schedules[key];
  if (!schedule) return res.status(404).json({ error: 'Ajakava pole selle kuu jaoks salvestatud' });
  res.json(schedule);
});

app.listen(PORT, () => {
  console.log(`JW Helper running on http://localhost:${PORT}`);
});
