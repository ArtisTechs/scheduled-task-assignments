// scheduleAssignmentService.js
export function canAssign(personId, date, assignments) {
  return !assignments[date]?.includes(personId);
}

export function autoAssign({ persons, part, date, assignments }) {
  return persons
    .filter(
      (p) =>
        p.roles.some((r) => part.allowedRoles.includes(r)) &&
        canAssign(p.id, date, assignments)
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, part.maxAssignees)
    .map((p) => p.id);
}

// personsService.js
export function getPersons() {
  return JSON.parse(localStorage.getItem("persons") || "[]");
}

// shared/utils/week.js
export function getWeekStart(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=Sun, 1=Mon
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().substring(0, 10);
}

export function getWeekRange(weekStartStr) {
  const start = new Date(weekStartStr);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: weekStartStr,
    end: end.toISOString().substring(0, 10),
  };
}

// shared/utils/week.js
export function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().substring(0, 10);
}

export function formatDateLong(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}