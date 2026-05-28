import React, { useEffect, useMemo, useRef, useState } from "react";
import { ROLES } from "../shared/constants/Roles";
import { MINISTERYO_RULES } from "../shared/constants";
import { STORAGE_KEYS } from "../shared/keys/storage.keys";
import { APP_SETTINGS } from "../shared/constants/Settings";

const CBS_KEY = "CBS";
const BIBLE_READING_KEY = "BIBLE_READING";
const LOCK_TOOLTIP = "Lock this part so Auto Assign will not change it.";
const PAHAYAG_RECENT_PARTS_LOOKBACK = 4;

function AssigneeDropdown({
  value,
  options,
  placeholder = "Select person",
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef(null);
  const selected = useMemo(
    () => options.find((entry) => entry.person.id === value),
    [options, value]
  );
  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter(({ person }) =>
      String(person.name || "").toLowerCase().includes(query)
    );
  }, [options, search]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }

    function handleEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="assignee-dropdown" ref={rootRef}>
      <button
        type="button"
        className="form-select assignee-dropdown-toggle"
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => !prev);
          setSearch("");
        }}
      >
        <span className="assignee-dropdown-value">
          {selected ? selected.person.name : placeholder}
        </span>
      </button>

      {open && (
        <div className="assignee-dropdown-menu">
          <div className="assignee-dropdown-search-wrap">
            <input
              type="text"
              className="form-control form-control-sm assignee-dropdown-search"
              placeholder="Search person..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <button
            type="button"
            className="assignee-dropdown-item"
            onClick={() => {
              onChange("");
              setOpen(false);
              setSearch("");
            }}
          >
            {placeholder}
          </button>
          {filteredOptions.map(({ person, isRuleBlocked }) => (
            <button
              key={person.id}
              type="button"
              className="assignee-dropdown-item"
              onClick={() => {
                onChange(person.id);
                setOpen(false);
                setSearch("");
              }}
            >
              {isRuleBlocked ? (
                <span className="assignee-dropdown-item-content">
                  <span className="assignee-status-dot" aria-hidden="true" />
                  {person.name}
                </span>
              ) : (
                person.name
              )}
            </button>
          ))}
          {filteredOptions.length === 0 && (
            <div className="assignee-dropdown-empty">No matching person</div>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================
   RESTRICTED ROLES (WEEK LOOKBACK RULE)
========================= */
const RESTRICTED_ROLES = [ROLES.STUDENT];

/* =========================
   WEEK HELPERS
========================= */
function getPreviousWeekKeys(
  weekStart,
  count = APP_SETTINGS.assignmentRules.excludeIfAssignedWithinWeeks
) {
  if (!weekStart) return [];

  const base = new Date(weekStart);
  if (isNaN(base.getTime())) return [];

  const weeks = [];

  for (let i = 1; i <= count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() - i * 7);
    weeks.push(d.toISOString().substring(0, 10));
  }

  return weeks;
}

function getRecentlyAssignedPersonIds(
  weekStart,
  count = APP_SETTINGS.assignmentRules.excludeIfAssignedWithinWeeks
) {
  if (count <= 0) return new Set();

  const raw = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
  if (!raw) return new Set();

  const all = JSON.parse(raw);
  const prevWeeks = getPreviousWeekKeys(weekStart, count);
  const used = new Set();

  prevWeeks.forEach((wk) => {
    const sched = all[wk];
    if (!sched) return;

    sched.sections?.forEach((sec) => {
      sec.items?.forEach((item) => {
        item.assignees?.forEach((id) => used.add(id));
      });
    });

    if (sched.chairman?.assignee) used.add(sched.chairman.assignee);
    if (sched.prayer?.assignee) used.add(sched.prayer.assignee);
  });

  return used;
}

function getRecentlyAssignedBibleReaderIds(
  weekStart,
  count = APP_SETTINGS.assignmentRules.excludeBibleReaderIfAssignedWithinWeeks
) {
  if (count <= 0) return new Set();

  const raw = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
  if (!raw) return new Set();

  const all = JSON.parse(raw);
  const prevWeeks = getPreviousWeekKeys(weekStart, count);
  const used = new Set();

  prevWeeks.forEach((wk) => {
    const sched = all[wk];
    if (!sched) return;

    sched.sections?.forEach((sec) => {
      sec.items?.forEach((item) => {
        if (item.key !== BIBLE_READING_KEY) return;
        item.assignees?.forEach((id) => used.add(id));
      });
    });
  });

  return used;
}

function isPahayagMinistryItem(section, item) {
  if (section?.key !== "MINISTERYO" || !item) return false;

  if (item.allowedRoles?.includes(ROLES.STUDENT_PAHAYAG)) {
    return true;
  }

  return (
    typeof item.title === "string" && item.title.toLowerCase().includes("pahayag")
  );
}

function getRecentlyAssignedPahayagIds(
  weekStart,
  count = PAHAYAG_RECENT_PARTS_LOOKBACK
) {
  if (count <= 0) return new Set();

  const raw = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
  if (!raw) return new Set();

  const all = JSON.parse(raw);
  const prevWeeks = Object.keys(all)
    .filter((wk) => wk < weekStart)
    .sort()
    .reverse();

  const used = new Set();
  let countedParts = 0;

  for (const wk of prevWeeks) {
    if (countedParts >= count) break;

    const sched = all[wk];
    const ministry = sched?.sections?.find((sec) => sec.key === "MINISTERYO");
    if (!ministry?.items) continue;

    for (const item of ministry.items) {
      if (countedParts >= count) break;
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

export default function EditableScheduleTable({
  schedule,
  persons,
  weekStart,
  onChange,
}) {
  function clone() {
    return JSON.parse(JSON.stringify(schedule));
  }

  function collectUsedThisScheduleExceptChairman(sched) {
    const used = new Set();
    if (!sched || !Array.isArray(sched.sections)) return used;

    sched.sections.forEach((s) => {
      if (!Array.isArray(s.items)) return;
      s.items.forEach((i) => {
        if (!Array.isArray(i.assignees)) return;
        i.assignees.forEach((id) => used.add(id));
      });
    });

    return used;
  }

  function getAssigneeOptions(
    sched,
    allowedRoles,
    currentAssignees = [],
    allowReuse = false
  ) {
    const studentRecentlyUsed = getRecentlyAssignedPersonIds(weekStart);
    const bibleReaderRecentlyUsed = getRecentlyAssignedBibleReaderIds(weekStart);
    const pahayagRecentlyUsed = getRecentlyAssignedPahayagIds(weekStart);
    const usedThisSchedule = collectUsedThisScheduleExceptChairman(sched);
    const isBibleReaderPart = allowedRoles.includes(ROLES.BIBLE_READER);
    const isPahayagPart = allowedRoles.includes(ROLES.STUDENT_PAHAYAG);

    return persons
      .filter((p) => p.roles?.some((r) => allowedRoles.includes(r)))
      .map((p) => {
        if (currentAssignees.includes(p.id)) {
          return { person: p, isRuleBlocked: false };
        }

        if (isPahayagPart && pahayagRecentlyUsed.has(p.id)) {
          return { person: p, isRuleBlocked: true };
        }

        if (!allowReuse && usedThisSchedule.has(p.id)) {
          return { person: p, isRuleBlocked: true };
        }

        if (isBibleReaderPart) {
          return {
            person: p,
            isRuleBlocked: bibleReaderRecentlyUsed.has(p.id),
          };
        }

        const isRestricted = p.roles.some((r) => RESTRICTED_ROLES.includes(r));
        const isRecentlyUsedStudent =
          !isPahayagPart && isRestricted && studentRecentlyUsed.has(p.id);

        return { person: p, isRuleBlocked: isRecentlyUsedStudent };
      });
  }

  function update(path, value) {
    const copy = clone();
    let ref = copy;
    for (let i = 0; i < path.length - 1; i++) ref = ref[path[i]];
    ref[path.at(-1)] = value;
    onChange(copy);
  }

  function removeItem(sectionIndex, itemIndex) {
    const copy = clone();
    copy.sections[sectionIndex].items.splice(itemIndex, 1);
    onChange(copy);
  }

  function addMinistryItem(sectionIndex, section) {
    const used = section.items.map((i) => i.title);
    const nextTitle =
      Object.keys(MINISTERYO_RULES).find((t) => !used.includes(t)) ||
      Object.keys(MINISTERYO_RULES)[0];

    const rule = MINISTERYO_RULES[nextTitle];

    const copy = clone();
    copy.sections[sectionIndex].items.push({
      key: crypto.randomUUID(),
      title: nextTitle,
      duration: 3,
      titleEditable: true,
      durationEditable: true,
      allowedRoles: rule.allowedRoles,
      maxAssignees: rule.maxAssignees,
      fixed: false,
      assignees: [],
      locked: false,
    });

    onChange(copy);
  }

  function addPamumuhayItem(sectionIndex) {
    const copy = clone();
    const items = copy.sections[sectionIndex].items;

    const newItem = {
      key: crypto.randomUUID(),
      title: "Local na Pangangailangan",
      duration: 15,
      titleEditable: true,
      durationEditable: true,
      allowedRoles: [ROLES.ELDER, ROLES.MS],
      maxAssignees: 1,
      fixed: false,
      assignees: [],
      locked: false,
    };

    const cbsIndex = items.findIndex((i) => i.key === CBS_KEY);
    if (cbsIndex === -1) items.push(newItem);
    else items.splice(cbsIndex, 0, newItem);

    onChange(copy);
  }

  function normalizePamumuhay(section) {
    const cbs = section.items.find((i) => i.key === CBS_KEY);
    const others = section.items.filter((i) => i.key !== CBS_KEY);
    return cbs ? [...others, cbs] : others;
  }

  return (
    <div className="table-responsive">
      <table className="table table-bordered align-middle schedule-edit-table">
        <tbody>
          <tr className="table-light fw-semibold">
            <td colSpan="2">Chairman</td>
            <td>
              <div className="d-flex align-items-center gap-2">
                <AssigneeDropdown
                  value={schedule.chairman.assignee}
                  placeholder="-"
                  options={getAssigneeOptions(
                    schedule,
                    schedule.chairman.allowedRoles,
                    [schedule.chairman.assignee],
                    true
                  )}
                  onChange={(nextValue) =>
                    update(["chairman", "assignee"], nextValue)
                  }
                />
                <input
                  type="checkbox"
                  className="form-check-input lock-checkbox m-0"
                  checked={!!schedule.chairman.locked}
                  title={LOCK_TOOLTIP}
                  aria-label="Lock chairman assignment"
                  onChange={(e) => update(["chairman", "locked"], e.target.checked)}
                />
              </div>
            </td>
          </tr>

          <tr>
            <td colSpan="3">
              Awit Blg.&nbsp;
              <input
                className="form-control d-inline w-auto"
                value={schedule.openingSong}
                onChange={(e) => update(["openingSong"], e.target.value)}
              />
            </td>
          </tr>

          {schedule.sections.map((section, si) => {
            const items =
              section.key === "PAMUMUHAY"
                ? normalizePamumuhay(section)
                : section.items;

            return (
              <React.Fragment key={section.key}>
                <tr className={`section-header section-${section.key.toLowerCase()}`}>
                  <td colSpan="3">{section.title}</td>
                </tr>

                {section.key === "PAMUMUHAY" && (
                  <tr>
                    <td colSpan="3">
                      Awit Blg.&nbsp;
                      <input
                        className="form-control d-inline w-auto"
                        value={schedule.pamumuhaySong}
                        onChange={(e) => update(["pamumuhaySong"], e.target.value)}
                      />
                    </td>
                  </tr>
                )}

                {items.map((item, ii) => (
                  <tr key={item.key}>
                    <td>
                      {section.key === "MINISTERYO" ? (
                        <select
                          className="form-select"
                          value={item.title}
                          onChange={(e) => {
                            const newTitle = e.target.value;
                            const rule = MINISTERYO_RULES[newTitle];

                            update(["sections", si, "items", ii], {
                              ...item,
                              title: newTitle,
                              allowedRoles: rule.allowedRoles,
                              maxAssignees: rule.maxAssignees,
                              assignees: [],
                            });
                          }}
                        >
                          {Object.keys(MINISTERYO_RULES).map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      ) : item.titleEditable ? (
                        <input
                          className="form-control"
                          value={item.title}
                          onChange={(e) =>
                            update(["sections", si, "items", ii, "title"], e.target.value)
                          }
                        />
                      ) : (
                        item.title
                      )}
                    </td>

                    <td width="120">
                      {item.durationEditable ? (
                        <input
                          type="number"
                          className="form-control"
                          value={item.duration}
                          onChange={(e) =>
                            update(["sections", si, "items", ii, "duration"], +e.target.value)
                          }
                        />
                      ) : (
                        `${item.duration} min`
                      )}
                    </td>

                    <td>
                      <div className="d-flex align-items-start gap-2">
                        <div className="flex-grow-1">
                          {Array.from({ length: item.maxAssignees }).map((_, slotIndex) => (
                            <div key={slotIndex} className="mb-1">
                              <AssigneeDropdown
                                value={item.assignees?.[slotIndex] || ""}
                                options={getAssigneeOptions(
                                  schedule,
                                  item.allowedRoles,
                                  item.assignees || []
                                )}
                                onChange={(nextValue) => {
                                  const updated = [...(item.assignees || [])];
                                  updated[slotIndex] = nextValue;

                                  update(
                                    ["sections", si, "items", ii, "assignees"],
                                    updated.filter(Boolean)
                                  );
                                }}
                              />
                            </div>
                          ))}

                          {!item.fixed && (
                            <button
                              className="btn btn-sm btn-outline-danger mt-1"
                              onClick={() => removeItem(si, ii)}
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <input
                          type="checkbox"
                          className="form-check-input lock-checkbox mt-2"
                          checked={!!item.locked}
                          title={LOCK_TOOLTIP}
                          aria-label={`Lock ${item.title} assignment`}
                          onChange={(e) =>
                            update(["sections", si, "items", ii, "locked"], e.target.checked)
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))}

                {section.key === "MINISTERYO" && (
                  <tr>
                    <td colSpan="3">
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => addMinistryItem(si, section)}
                      >
                        + Add Ministry Part
                      </button>
                    </td>
                  </tr>
                )}

                {section.key === "PAMUMUHAY" && (
                  <tr>
                    <td colSpan="3">
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => addPamumuhayItem(si)}
                      >
                        + Add Pamumuhay Part
                      </button>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}

          <tr>
            <td colSpan="3">
              Awit Blg.&nbsp;
              <input
                className="form-control d-inline w-auto"
                value={schedule.closingSong}
                onChange={(e) => update(["closingSong"], e.target.value)}
              />
            </td>
          </tr>

          <tr className="table-light fw-semibold">
            <td colSpan="2">Panalangin</td>
            <td>
              <div className="d-flex align-items-center gap-2">
                <AssigneeDropdown
                  value={schedule.prayer.assignee}
                  placeholder="-"
                  options={getAssigneeOptions(
                    schedule,
                    schedule.prayer.allowedRoles,
                    [schedule.prayer.assignee],
                    true
                  )}
                  onChange={(nextValue) => update(["prayer", "assignee"], nextValue)}
                />
                <input
                  type="checkbox"
                  className="form-check-input lock-checkbox m-0"
                  checked={!!schedule.prayer.locked}
                  title={LOCK_TOOLTIP}
                  aria-label="Lock prayer assignment"
                  onChange={(e) => update(["prayer", "locked"], e.target.checked)}
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
