import React, { useEffect, useState } from "react";
import EditableScheduleTable from "../components/EditableScheduleTable";
import ScheduleTableView from "../components/ScheduleTableView";
import FullscreenLoader from "../components/FullscreenLoader";

import { STORAGE_KEYS } from "../shared/keys/storage.keys";
import {
  addDays,
  getWeekStart,
  getWeekRange,
  formatDateLong,
  autoAssignSchedule,
} from "../shared/services/schedule-assignment.service";
import { MINISTERYO_RULES, SCHEDULE_TEMPLATE } from "../shared/constants";
import { showToast } from "../shared/services/toast.service";

import {
  fetchAllSchedulesAndCache,
  saveWeeklySchedule,
} from "../shared/services/schedule.firestore";
import { fetchPersons } from "../shared/services/persons.firestore";

/* =======================
   NORMALIZER (CRITICAL)
======================= */
function normalizeSchedule(loaded) {
  const normalized = {
    ...structuredClone(SCHEDULE_TEMPLATE),
    ...loaded,

    chairman: {
      ...SCHEDULE_TEMPLATE.chairman,
      ...(loaded?.chairman || {}),
    },

    prayer: {
      ...SCHEDULE_TEMPLATE.prayer,
      ...(loaded?.prayer || {}),
    },

    sections: SCHEDULE_TEMPLATE.sections.map((tplSection) => {
      const loadedSection = loaded?.sections?.find(
        (s) => s.key === tplSection.key
      );

      return {
        ...tplSection,
        ...(loadedSection || {}),
        items: loadedSection?.items ?? structuredClone(tplSection.items),
      };
    }),
  };

  normalized.chairman.locked = false;
  normalized.prayer.locked = false;
  normalized.sections = (normalized.sections || []).map((section) => ({
    ...section,
    items: (section.items || []).map((item) => ({
      ...item,
      locked: false,
    })),
  }));

  const kayamanan = normalized.sections.find((s) => s.key === "KAYAMANAN");
  const talkItem = kayamanan?.items?.find((item) => item.key === "TALK");
  if (talkItem && (!talkItem.title || talkItem.title === "Talk")) {
    talkItem.title = "Talk: ";
  }

  const MINISTRY_TITLE_MIGRATION = {
    "Ipaliwanag ang Paniniwala mo":
      "Ipaliwanag ang Paniniwala Mo - Pagtatanghal",
  };

  const ministeryo = normalized.sections.find((s) => s.key === "MINISTERYO");
  ministeryo?.items?.forEach((item) => {
    const migratedTitle = MINISTRY_TITLE_MIGRATION[item.title];
    if (migratedTitle) {
      item.title = migratedTitle;
    }

    const rule = MINISTERYO_RULES[item.title];
    if (!rule) return;

    item.allowedRoles = rule.allowedRoles;
    item.maxAssignees = rule.maxAssignees;
  });

  return normalized;
}

function stripTransientLocks(schedule) {
  const copy = structuredClone(schedule);

  if (copy.chairman) {
    delete copy.chairman.locked;
  }

  if (copy.prayer) {
    delete copy.prayer.locked;
  }

  copy.sections = (copy.sections || []).map((section) => ({
    ...section,
    items: (section.items || []).map((item) => {
      const next = { ...item };
      delete next.locked;
      return next;
    }),
  }));

  return copy;
}

export default function ScheduleMainPage({ viewOnly = false }) {
  const today = new Date().toISOString().substring(0, 10);
  const currentWeekStart = getWeekStart(today);

  const [selectedDate, setSelectedDate] = useState(today);
  const [weekStart, setWeekStart] = useState(getWeekStart(today));
  const [weekRange, setWeekRange] = useState(getWeekRange(weekStart));

  const [persons, setPersons] = useState([]);
  const [schedule, setSchedule] = useState(structuredClone(SCHEDULE_TEMPLATE));

  const [viewMode, setViewMode] = useState(true);
  const [saving, setSaving] = useState(false);
  const isPastWeek = weekStart < currentWeekStart;
  const canEdit = !viewOnly && !isPastWeek;

  /* ---- WEEK SYNC ---- */
  useEffect(() => {
    const ws = getWeekStart(selectedDate);
    setWeekStart(ws);
    setWeekRange(getWeekRange(ws));
  }, [selectedDate]);

  /* ---- PERSONS ---- */
  useEffect(() => {
    async function loadPersons() {
      const raw = localStorage.getItem(STORAGE_KEYS.PERSONS);

      if (raw) {
        setPersons(JSON.parse(raw));
        return;
      }

      if (viewOnly) {
        const personsData = await fetchPersons();
        setPersons(personsData);
        localStorage.setItem(STORAGE_KEYS.PERSONS, JSON.stringify(personsData));
      }
    }

    loadPersons();
  }, [viewOnly]);

  /* ---- SCHEDULE LOAD ---- */
  useEffect(() => {
    async function load() {
      const all = await fetchAllSchedulesAndCache();
      const weekly = all[weekStart];

      setSchedule(
        weekly ? normalizeSchedule(weekly) : structuredClone(SCHEDULE_TEMPLATE)
      );
    }
    load();
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
    if (!raw) {
      setSchedule(structuredClone(SCHEDULE_TEMPLATE));
      return;
    }

    const all = JSON.parse(raw);
    const weekly = all[weekStart];

    setSchedule(
      weekly ? normalizeSchedule(weekly) : structuredClone(SCHEDULE_TEMPLATE)
    );
  }, [weekStart]);

  useEffect(() => {
    if (isPastWeek && !viewMode) {
      setViewMode(true);
    }
  }, [isPastWeek, viewMode]);

  async function saveSchedule() {
    if (!canEdit) {
      if (isPastWeek) {
        showToast("Past schedules are read-only.");
      }
      return;
    }

    setSaving(true);
    try {
      const persistableSchedule = stripTransientLocks(schedule);
      await saveWeeklySchedule(weekStart, persistableSchedule);

      const all = await fetchAllSchedulesAndCache();

      localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(all));

      const weekly = all[weekStart];
      setSchedule(
        weekly ? normalizeSchedule(weekly) : structuredClone(SCHEDULE_TEMPLATE)
      );

      showToast("Schedule saved successfully.");
    } finally {
      setSaving(false);
    }
  }

  function handleAutoAssign() {
    if (!canEdit) {
      if (isPastWeek) {
        showToast("Past schedules are read-only.");
      }
      return;
    }

    const updated = autoAssignSchedule({
      schedule,
      persons,
      weekStart,
    });

    setSchedule(updated);
  }

  return (
    <>
      {saving && <FullscreenLoader text="Saving schedule…" />}

      <div className="container mt-3">
        {/* WEEK NAV */}
        <div className="d-flex align-items-center gap-2 mb-2">
          <button
            className="btn btn-outline-secondary"
            onClick={() => setSelectedDate((d) => addDays(d, -7))}
          >
            ‹
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="form-control w-auto"
          />

          <button
            className="btn btn-outline-secondary"
            onClick={() => setSelectedDate((d) => addDays(d, 7))}
          >
            ›
          </button>
        </div>

        {/* WEEK RANGE */}
        <div className="alert alert-light border fw-semibold mb-2 week-range">
          Week:&nbsp;
          <span className="fw-bold fs-5">
            {formatDateLong(weekRange.start)}
          </span>
          &nbsp;–&nbsp;
          <span className="fw-bold fs-5">{formatDateLong(weekRange.end)}</span>
        </div>

        {/* MODE LABEL */}
        <div className="d-flex justify-content-between align-items-center mb-2">
          <strong>{viewMode ? "" : "Edit Mode"}</strong>

          {canEdit && (
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setViewMode((v) => !v)}
            >
              {viewMode ? "Switch to Edit" : "Switch to View"}
            </button>
          )}
        </div>

        {isPastWeek && !viewOnly && (
          <div className="alert alert-warning py-2">
            Past schedules are view-only and cannot be edited.
          </div>
        )}

        {/* TABLE */}
        {viewMode || !canEdit ? (
          <ScheduleTableView schedule={schedule} persons={persons} />
        ) : (
          <EditableScheduleTable
            schedule={schedule}
            persons={persons}
            weekStart={weekStart}
            onChange={setSchedule}
          />
        )}

        {/* ACTIONS */}
        {!viewMode && canEdit && (
          <div className="d-flex gap-2 mt-3">
            <button
              className="btn btn-outline-primary"
              onClick={handleAutoAssign}
            >
              Auto Assign
            </button>

            <button className="btn btn-primary" onClick={saveSchedule}>
              Save Schedule
            </button>
          </div>
        )}
      </div>
    </>
  );
}
