import { MINISTERYO_RULES, ROLES } from "../constants";
import { APP_SETTINGS } from "../constants/Settings";
import { STORAGE_KEYS } from "../keys/storage.keys";

const RESTRICTED_ROLES = [
  ROLES.STUDENT,
];
const PART_REPEAT_LOOKBACK_WEEKS = 1;
const BIBLE_READING_PART_KEY = "BIBLE_READING";
const PAHAYAG_PART_HISTORY_KEY = "MINISTERYO_PAHAYAG";
const PAHAYAG_RECENT_PARTS_LOOKBACK = 4;

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

function hasLeadershipRole(p) {
  return p.roles?.includes(ROLES.ELDER) || p.roles?.includes(ROLES.MS);
}

function isPahayagMinistryItem(section, item) {
  if (section?.key !== "MINISTERYO" || !item) return false;

  if (item.allowedRoles?.includes(ROLES.STUDENT_PAHAYAG)) {
    return true;
  }

  return typeof item.title === "string" && item.title.toLowerCase().includes("pahayag");
}

function getPartHistoryKey(section, item) {
  if (isPahayagMinistryItem(section, item)) {
    return PAHAYAG_PART_HISTORY_KEY;
  }

  if (section?.key === "MINISTERYO") {
    return item?.title || item?.key || "";
  }

  return item?.key || item?.title || "";
}

function getAllSchedules() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEDULES) || "{}");
}

function getRecentWeekKeys(
  currentWeekStart,
  weeks = APP_SETTINGS.assignmentRules.excludeIfAssignedWithinWeeks
) {
  if (!currentWeekStart) return [];

  const all = getAllSchedules();
  return Object.keys(all)
    .filter((d) => d < currentWeekStart)
    .sort()
    .reverse()
    .slice(0, weeks);
}

function getRecentAssignments(
  personId,
  currentWeekStart,
  weeks = APP_SETTINGS.assignmentRules.excludeIfAssignedWithinWeeks
) {
  if (!currentWeekStart) return false;

  const all = getAllSchedules();
  const dates = getRecentWeekKeys(currentWeekStart, weeks);

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

function isAssignedToPartInSchedule(sched, personId, partKey) {
  if (!sched || !partKey) return false;

  if (partKey === "CHAIRMAN") {
    return sched.chairman?.assignee === personId;
  }

  if (partKey === "PRAYER") {
    return sched.prayer?.assignee === personId;
  }

  return sched.sections?.some((section) =>
    section.items?.some((item) => {
      const itemKey = getPartHistoryKey(section, item);
      return itemKey === partKey && item.assignees?.includes(personId);
    })
  );
}

function wasAssignedToPartRecently(
  personId,
  partKey,
  currentWeekStart,
  weeks = APP_SETTINGS.assignmentRules.excludeIfAssignedWithinWeeks
) {
  if (!currentWeekStart || !partKey) return false;

  const all = getAllSchedules();
  const dates = getRecentWeekKeys(currentWeekStart, weeks);

  return dates.some((week) => {
    const sched = all[week];
    return isAssignedToPartInSchedule(sched, personId, partKey);
  });
}

function collectUsedFromLockedParts(schedule) {
  const used = new Set();

  if (schedule.chairman?.locked && schedule.chairman.assignee) {
    used.add(schedule.chairman.assignee);
  }

  schedule.sections?.forEach((s) =>
    s.items?.forEach((i) => {
      if (!i.locked) return;
      (i.assignees || []).forEach((id) => used.add(id));
    })
  );

  if (schedule.prayer?.locked && schedule.prayer.assignee) {
    used.add(schedule.prayer.assignee);
  }

  return used;
}

function getRecentPahayagAssigneeIdsFromHistory(
  allSchedules,
  historicalWeeks,
  partCount = PAHAYAG_RECENT_PARTS_LOOKBACK
) {
  if (!allSchedules || !Array.isArray(historicalWeeks) || partCount <= 0) {
    return new Set();
  }

  const used = new Set();
  let countedParts = 0;

  for (const week of historicalWeeks) {
    if (countedParts >= partCount) break;

    const sched = allSchedules[week];
    if (!sched) continue;

    const ministry = sched.sections?.find((section) => section.key === "MINISTERYO");
    if (!ministry?.items) continue;

    for (const item of ministry.items) {
      if (countedParts >= partCount) break;
      if (!isPahayagMinistryItem(ministry, item)) continue;

      const assignees = Array.isArray(item.assignees)
        ? item.assignees.filter(Boolean)
        : [];

      if (assignees.length === 0) continue;

      assignees.forEach((id) => used.add(id));
      countedParts += 1;
    }
  }

  return used;
}

export function autoAssignSchedule({ schedule, persons, weekStart }) {
  const copy = structuredClone(schedule);
  const usedThisWeek = collectUsedFromLockedParts(copy);
  const allSchedules = getAllSchedules();
  const historicalWeeks = Object.keys(allSchedules)
    .filter((d) => d < weekStart)
    .sort()
    .reverse();

  const recentAssignmentCache = new Map();
  const recentPartCache = new Map();
  const partLastAssignedAtCache = new Map();
  const recentPahayagAssignees = getRecentPahayagAssigneeIdsFromHistory(
    allSchedules,
    historicalWeeks
  );

  function hasRecentAssignment(personId) {
    if (recentAssignmentCache.has(personId)) {
      return recentAssignmentCache.get(personId);
    }

    const value = getRecentAssignments(personId, weekStart);
    recentAssignmentCache.set(personId, value);
    return value;
  }

  function hasRecentPartAssignment(
    personId,
    partKey,
    weeks = PART_REPEAT_LOOKBACK_WEEKS
  ) {
    const cacheKey = `${personId}|${partKey}|${weeks}`;

    if (recentPartCache.has(cacheKey)) {
      return recentPartCache.get(cacheKey);
    }

    const value = wasAssignedToPartRecently(personId, partKey, weekStart, weeks);
    recentPartCache.set(cacheKey, value);
    return value;
  }

  function hasRecentPahayagAssignment(personId) {
    return recentPahayagAssignees.has(personId);
  }

  function getLastAssignedAtForPart(personId, partKey) {
    const cacheKey = `${personId}|${partKey}`;
    if (partLastAssignedAtCache.has(cacheKey)) {
      return partLastAssignedAtCache.get(cacheKey);
    }

    let timestamp = Number.MIN_SAFE_INTEGER;

    for (const week of historicalWeeks) {
      const sched = allSchedules[week];
      if (!isAssignedToPartInSchedule(sched, personId, partKey)) continue;
      timestamp = new Date(week).getTime();
      break;
    }

    partLastAssignedAtCache.set(cacheKey, timestamp);
    return timestamp;
  }

  function orderTierCandidates(candidates, partKey, rotateByPart = true) {
    if (candidates.length === 0) return [];

    if (rotateByPart && partKey) {
      return [...candidates].sort((a, b) => {
        const aLast = getLastAssignedAtForPart(a.id, partKey);
        const bLast = getLastAssignedAtForPart(b.id, partKey);

        if (aLast !== bLast) return aLast - bLast;
        return a.name.localeCompare(b.name);
      });
    }

    // Preserve random rotation for non-leadership pools.
    if (candidates.every((p) => !hasLeadershipRole(p))) {
      return shuffle(candidates);
    }

    return [...candidates].sort((a, b) => a.name.localeCompare(b.name));
  }

  function getCandidatesByPriority(
    allowedRoles,
    partKey,
    excludedIds = new Set(),
    {
      avoidWeeklyPartRepeat = true,
      rotateByPart = true,
      partRepeatWeeks = PART_REPEAT_LOOKBACK_WEEKS,
      applyRestrictedWeeksFilter = true,
    } = {}
  ) {
    const tiers = [
      {
        allowUsedThisWeek: false,
        allowRecentPart: false,
        allowRecentRestrictedAny: false,
      },
      {
        allowUsedThisWeek: false,
        allowRecentPart: false,
        allowRecentRestrictedAny: true,
      },
      {
        allowUsedThisWeek: false,
        allowRecentPart: true,
        allowRecentRestrictedAny: true,
      },
      {
        allowUsedThisWeek: true,
        allowRecentPart: false,
        allowRecentRestrictedAny: true,
      },
      {
        allowUsedThisWeek: true,
        allowRecentPart: true,
        allowRecentRestrictedAny: true,
      },
    ];

    const unique = [];
    const seen = new Set();

    tiers.forEach((tier) => {
      const isPahayagPart =
        partKey === PAHAYAG_PART_HISTORY_KEY ||
        allowedRoles.includes(ROLES.STUDENT_PAHAYAG);

      const tierCandidates = persons.filter((p) => {
        if (seen.has(p.id)) return false;
        if (excludedIds.has(p.id)) return false;
        if (!p.roles?.some((r) => allowedRoles.includes(r))) return false;
        if (isPahayagPart && hasRecentPahayagAssignment(p.id)) return false;
        if (!tier.allowUsedThisWeek && usedThisWeek.has(p.id)) return false;
        if (
          avoidWeeklyPartRepeat &&
          !tier.allowRecentPart &&
          hasRecentPartAssignment(p.id, partKey, partRepeatWeeks)
        ) {
          return false;
        }

        const isRestricted = p.roles.some((r) => RESTRICTED_ROLES.includes(r));
        if (
          !isPahayagPart &&
          applyRestrictedWeeksFilter &&
          isRestricted &&
          !tier.allowRecentRestrictedAny &&
          hasRecentAssignment(p.id)
        ) {
          return false;
        }

        return true;
      });

      orderTierCandidates(tierCandidates, partKey, rotateByPart).forEach((p) => {
        seen.add(p.id);
        unique.push(p);
      });
    });

    return unique;
  }

  function pickCandidates(
    allowedRoles,
    max,
    partKey,
    excludedIds = new Set(),
    options = {}
  ) {
    const ordered = getCandidatesByPriority(
      allowedRoles,
      partKey,
      excludedIds,
      options
    );

    /* ---- SINGLE ASSIGNEE ---- */
    if (max === 1) {
      return ordered.slice(0, 1);
    }

    /* ---- PAIR ASSIGNMENT (GENDER-SAFE) ---- */
    if (max === 2) {
      const malePair = ordered.filter(isMale).slice(0, 2);
      const femalePair = ordered.filter(isFemale).slice(0, 2);

      if (malePair.length === 2 && femalePair.length === 2) {
        const secondMaleRank = ordered.findIndex((p) => p.id === malePair[1].id);
        const secondFemaleRank = ordered.findIndex(
          (p) => p.id === femalePair[1].id
        );
        return secondMaleRank <= secondFemaleRank ? malePair : femalePair;
      }

      if (malePair.length === 2) return malePair;
      if (femalePair.length === 2) return femalePair;

      // Fallback to avoid leaving the part fully empty.
      if (ordered.length > 0) {
        return ordered.slice(0, Math.min(ordered.length, max));
      }
    }

    /* ---- FALLBACK ---- */
    return ordered.slice(0, max);
  }

  /* ---- Chairman ---- */
  if (!copy.chairman?.locked) {
    const existing = copy.chairman.assignee
      ? new Set([copy.chairman.assignee])
      : new Set();
    const [p] =
      pickCandidates(copy.chairman.allowedRoles, 1, "CHAIRMAN", existing) ||
      [];
    const [fallback] = pickCandidates(
      copy.chairman.allowedRoles,
      1,
      "CHAIRMAN"
    );
    const chosen = p || fallback;
    if (chosen) {
      copy.chairman.assignee = chosen.id;
      usedThisWeek.add(chosen.id);
    } else if (copy.chairman.assignee) {
      usedThisWeek.add(copy.chairman.assignee);
    }
  } else if (copy.chairman.assignee) {
    usedThisWeek.add(copy.chairman.assignee);
  }

  /* ---- Sections ---- */
  copy.sections.forEach((section) => {
    section.items.forEach((item) => {
      const rules =
        section.key === "MINISTERYO" ? MINISTERYO_RULES[item.title] : item;

      if (!rules) return;

      item.allowedRoles = rules.allowedRoles;
      item.maxAssignees = rules.maxAssignees || item.maxAssignees;
      const partKey = getPartHistoryKey(section, item);
      const isBibleReadingPart = partKey === BIBLE_READING_PART_KEY;
      const avoidWeeklyPartRepeat =
        section.key !== "PAMUMUHAY" || item.key === "CBS";
      const bibleReaderWeeks = Math.max(
        0,
        APP_SETTINGS.assignmentRules.excludeBibleReaderIfAssignedWithinWeeks ?? 0
      );
      const candidateOptions = isBibleReadingPart
        ? {
            avoidWeeklyPartRepeat: bibleReaderWeeks > 0,
            rotateByPart: bibleReaderWeeks > 0,
            partRepeatWeeks: bibleReaderWeeks,
            applyRestrictedWeeksFilter: false,
          }
        : {
            avoidWeeklyPartRepeat,
            rotateByPart: avoidWeeklyPartRepeat,
          };

      if (item.locked) {
        item.assignees = item.assignees || [];
        item.assignees.forEach((id) => usedThisWeek.add(id));
        return;
      }

      const existingIds = new Set(item.assignees || []);
      const candidates =
        pickCandidates(
          rules.allowedRoles,
          rules.maxAssignees,
          partKey,
          existingIds,
          candidateOptions
        ) || [];
      const finalCandidates =
        candidates.length > 0
          ? candidates
          : pickCandidates(
              rules.allowedRoles,
              rules.maxAssignees,
              partKey,
              new Set(),
              candidateOptions
            );

      if (finalCandidates.length > 0) {
        item.assignees = finalCandidates.map((p) => {
          usedThisWeek.add(p.id);
          return p.id;
        });
      } else {
        item.assignees = item.assignees || [];
        item.assignees.forEach((id) => usedThisWeek.add(id));
      }
    });
  });

  /* ---- Prayer ---- */
  if (!copy.prayer?.locked) {
    const existing = copy.prayer.assignee
      ? new Set([copy.prayer.assignee])
      : new Set();
    const [p] =
      pickCandidates(copy.prayer.allowedRoles, 1, "PRAYER", existing) || [];
    const [fallback] = pickCandidates(copy.prayer.allowedRoles, 1, "PRAYER");
    const chosen = p || fallback;
    if (chosen) {
      copy.prayer.assignee = chosen.id;
      usedThisWeek.add(chosen.id);
    } else if (copy.prayer.assignee) {
      usedThisWeek.add(copy.prayer.assignee);
    }
  } else if (copy.prayer.assignee) {
    usedThisWeek.add(copy.prayer.assignee);
  }

  return copy;
}
