import { MINISTERYO_RULES, ROLES } from "../constants";
import { APP_SETTINGS } from "../constants/Settings";
import { STORAGE_KEYS } from "../keys/storage.keys";

const RESTRICTED_ROLES = [
  ROLES.STUDENT,
  ROLES.STUDENT_PAHAYAG,
  ROLES.BIBLE_READER,
];

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

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function isMale(p) {
  return p.roles?.includes(ROLES.MALE);
}

function isFemale(p) {
  return p.roles?.includes(ROLES.FEMALE);
}

function getAllSchedules() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEDULES) || "{}");
}

function getRecentAssignments(
  personId,
  currentWeekStart,
  weeks = APP_SETTINGS.assignmentRules.excludeIfAssignedWithinWeeks
) {
  if (!currentWeekStart) return false;

  const all = getAllSchedules();
  const dates = Object.keys(all)
    .filter((d) => d < currentWeekStart)
    .sort()
    .reverse()
    .slice(0, weeks);

  return dates.some((week) => {
    const sched = all[week];
    if (!sched) return false;

    if (sched.chairman?.assignee === personId) return true;
    if (sched.prayer?.assignee === personId) return true;

    return sched.sections?.some((s) =>
      s.items?.some((i) => i.assignees?.includes(personId))
    );
  });
}

function collectUsedThisWeek(schedule) {
  const used = new Set();

  if (schedule.chairman.assignee) used.add(schedule.chairman.assignee);
  if (schedule.prayer.assignee) used.add(schedule.prayer.assignee);

  schedule.sections.forEach((s) =>
    s.items.forEach((i) => (i.assignees || []).forEach((id) => used.add(id)))
  );

  return used;
}

export function autoAssignSchedule({ schedule, persons, weekStart }) {
  const copy = structuredClone(schedule);
  const usedThisWeek = collectUsedThisWeek(copy);

  function pickCandidates(allowedRoles, max, partKey) {
    const eligible = persons.filter((p) => {
      if (!p.roles?.some((r) => allowedRoles.includes(r))) return false;
      if (usedThisWeek.has(p.id)) return false;

      const isRestricted = p.roles.some((r) => RESTRICTED_ROLES.includes(r));

      // Apply 4-week rule ONLY to restricted roles
      if (isRestricted) {
        return !getRecentAssignments(p.id, weekStart);
      }

      // Existing ELDER / MS rotation stays intact
      if (p.roles.includes(ROLES.ELDER) || p.roles.includes(ROLES.MS)) {
        const recentParts = getRecentParts(p.id, weekStart);
        return !recentParts.has(partKey);
      }

      return true;
    });

    /* ---- SINGLE ASSIGNEE ---- */
    if (max === 1) {
      const ordered = eligible.every(
        (p) => !p.roles.includes("ELDER") && !p.roles.includes("MS")
      )
        ? shuffle(eligible)
        : eligible.sort((a, b) => a.name.localeCompare(b.name));

      return ordered.slice(0, 1);
    }

    /* ---- PAIR ASSIGNMENT (GENDER-SAFE) ---- */
    if (max === 2) {
      const males = eligible.filter(isMale);
      const females = eligible.filter(isFemale);

      const malePair = males.length >= 2 ? shuffle(males).slice(0, 2) : [];
      const femalePair =
        females.length >= 2 ? shuffle(females).slice(0, 2) : [];

      // Prefer whichever pool is larger (fairer rotation)
      if (malePair.length && femalePair.length) {
        return males.length >= females.length ? malePair : femalePair;
      }

      return malePair.length ? malePair : femalePair;
    }

    /* ---- FALLBACK ---- */
    return [];
  }

  /* ---- Chairman ---- */
  if (!copy.chairman.assignee) {
    const [p] = pickCandidates(copy.chairman.allowedRoles, 1, "CHAIRMAN");
    if (p) {
      copy.chairman.assignee = p.id;
      usedThisWeek.add(p.id);
    }
  }

  /* ---- Sections ---- */
  copy.sections.forEach((section) => {
    section.items.forEach((item) => {
      const rules =
        section.key === "MINISTERYO" ? MINISTERYO_RULES[item.title] : item;

      if (!rules) return;

      item.allowedRoles = rules.allowedRoles;
      item.maxAssignees = rules.maxAssignees || item.maxAssignees;

      const candidates = pickCandidates(
        rules.allowedRoles,
        rules.maxAssignees,
        item.key || item.title
      );

      if (candidates.length > 0) {
        item.assignees = candidates.map((p) => {
          usedThisWeek.add(p.id);
          return p.id;
        });
      } else {
        item.assignees = item.assignees || [];
      }
    });
  });

  /* ---- Prayer ---- */
  if (!copy.prayer.assignee) {
    const [p] = pickCandidates(copy.prayer.allowedRoles, 1, "PRAYER");
    if (p) copy.prayer.assignee = p.id;
  }

  return copy;
}

function getRecentParts(personId, currentWeekStart, weeks = 4) {
  const all = getAllSchedules();
  const dates = Object.keys(all).sort().reverse();

  const history = new Set();

  dates
    .filter((d) => d < currentWeekStart)
    .slice(0, weeks)
    .forEach((week) => {
      const sched = all[week];
      if (!sched) return;

      if (sched.chairman?.assignee === personId) history.add("CHAIRMAN");

      if (sched.prayer?.assignee === personId) history.add("PRAYER");

      sched.sections?.forEach((s) =>
        s.items?.forEach((i) => {
          if (i.assignees?.includes(personId)) {
            history.add(i.key || i.title);
          }
        })
      );
    });

  return history;
}
