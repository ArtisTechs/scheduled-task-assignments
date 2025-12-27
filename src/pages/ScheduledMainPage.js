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
import { SCHEDULE_TEMPLATE } from "../shared/constants";
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
  return {
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
}

export default function ScheduleMainPage({ viewOnly = false }) {
  const today = new Date().toISOString().substring(0, 10);

  const [selectedDate, setSelectedDate] = useState(today);
  const [weekStart, setWeekStart] = useState(getWeekStart(today));
  const [weekRange, setWeekRange] = useState(getWeekRange(weekStart));

  const [persons, setPersons] = useState([]);
  const [schedule, setSchedule] = useState(structuredClone(SCHEDULE_TEMPLATE));

  const [viewMode, setViewMode] = useState(true);
  const [saving, setSaving] = useState(false);

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

  async function saveSchedule() {
    if (viewOnly) return;

    setSaving(true);
    try {
      await saveWeeklySchedule(weekStart, schedule);
      showToast("Schedule saved successfully.");
    } finally {
      setSaving(false);
    }
  }

  function handleAutoAssign() {
    if (viewOnly) return;

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

          {!viewOnly && (
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setViewMode((v) => !v)}
            >
              {viewMode ? "Switch to Edit" : "Switch to View"}
            </button>
          )}
        </div>

        {/* TABLE */}
        {viewMode ? (
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
        {!viewMode && !viewOnly && (
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
