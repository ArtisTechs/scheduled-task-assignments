import React, { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
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

const SCHEDULE_COPY_PADDING_PX = 12;
const SCHEDULE_COPY_MIN_WIDTH_PX = 1200;

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
  const [hasWeeklySchedule, setHasWeeklySchedule] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [viewMode, setViewMode] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copyingSchedule, setCopyingSchedule] = useState(false);
  const scheduleCaptureRef = useRef(null);
  const loadingTasksRef = useRef(0);
  const isPastWeek = weekStart < currentWeekStart;
  const canEdit = !viewOnly && !isPastWeek;

  function startLoading() {
    loadingTasksRef.current += 1;
    setIsLoadingData(true);
  }

  function stopLoading() {
    loadingTasksRef.current = Math.max(loadingTasksRef.current - 1, 0);
    if (loadingTasksRef.current === 0) {
      setIsLoadingData(false);
    }
  }

  /* ---- WEEK SYNC ---- */
  useEffect(() => {
    const ws = getWeekStart(selectedDate);
    setWeekStart(ws);
    setWeekRange(getWeekRange(ws));
  }, [selectedDate]);

  /* ---- PERSONS ---- */
  useEffect(() => {
    let cancelled = false;

    async function loadPersons() {
      const raw = localStorage.getItem(STORAGE_KEYS.PERSONS);

      if (raw) {
        if (!cancelled) {
          setPersons(JSON.parse(raw));
        }
        return;
      }

      if (viewOnly) {
        startLoading();
        try {
          const personsData = await fetchPersons();
          if (cancelled) return;
          setPersons(personsData);
          localStorage.setItem(
            STORAGE_KEYS.PERSONS,
            JSON.stringify(personsData)
          );
        } finally {
          if (!cancelled) {
            stopLoading();
          }
        }
      }
    }

    loadPersons();

    return () => {
      cancelled = true;
    };
  }, [viewOnly]);

  /* ---- SCHEDULE LOAD ---- */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      startLoading();
      try {
        const all = await fetchAllSchedulesAndCache();
        if (cancelled) return;

        const weekly = all[weekStart];

        setHasWeeklySchedule(!!weekly);
        setSchedule(
          weekly ? normalizeSchedule(weekly) : structuredClone(SCHEDULE_TEMPLATE)
        );
      } catch (error) {
        if (cancelled) return;

        const raw = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
        if (raw) {
          const all = JSON.parse(raw);
          const weekly = all[weekStart];

          setHasWeeklySchedule(!!weekly);
          setSchedule(
            weekly
              ? normalizeSchedule(weekly)
              : structuredClone(SCHEDULE_TEMPLATE)
          );
        } else {
          setHasWeeklySchedule(false);
          setSchedule(structuredClone(SCHEDULE_TEMPLATE));
        }
      } finally {
        if (!cancelled) {
          stopLoading();
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
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
      setHasWeeklySchedule(!!weekly);
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

  async function handleCopyScheduleImage() {
    if (!scheduleCaptureRef.current) return;

    setCopyingSchedule(true);
    const sourceNode = scheduleCaptureRef.current;
    const captureWrapper = document.createElement("div");
    const clonedNode = sourceNode.cloneNode(true);

    try {
      const captureWidth = Math.max(
        SCHEDULE_COPY_MIN_WIDTH_PX,
        sourceNode.scrollWidth || 0
      );

      captureWrapper.style.position = "fixed";
      captureWrapper.style.left = "-10000px";
      captureWrapper.style.top = "0";
      captureWrapper.style.padding = `${SCHEDULE_COPY_PADDING_PX}px`;
      captureWrapper.style.background = "#f3f3f3";
      captureWrapper.style.boxSizing = "border-box";
      captureWrapper.style.width = `${captureWidth}px`;
      captureWrapper.style.overflow = "hidden";
      captureWrapper.style.display = "inline-block";

      const copyDateLabel = document.createElement("div");
      copyDateLabel.textContent = `Week: ${formatDateLong(
        weekRange.start
      )} - ${formatDateLong(weekRange.end)}`;
      copyDateLabel.style.fontWeight = "700";
      copyDateLabel.style.fontSize = "17px";
      copyDateLabel.style.marginBottom = "8px";
      copyDateLabel.style.color = "#222";
      copyDateLabel.style.whiteSpace = "nowrap";

      clonedNode.style.width = "100%";
      clonedNode.style.margin = "0";
      clonedNode.style.padding = "0";
      clonedNode.style.background = "transparent";
      clonedNode.style.borderRadius = "0";
      clonedNode.style.boxSizing = "border-box";

      const responsiveWrap = clonedNode.querySelector(".table-responsive");
      if (responsiveWrap) {
        responsiveWrap.style.width = "100%";
        responsiveWrap.style.margin = "0";
        responsiveWrap.style.overflowX = "visible";
      }

      const table = clonedNode.querySelector("table");
      if (table) {
        table.style.width = "100%";
        table.style.maxWidth = "none";
      }

      captureWrapper.appendChild(copyDateLabel);
      captureWrapper.appendChild(clonedNode);
      document.body.appendChild(captureWrapper);

      const canvas = await html2canvas(captureWrapper, {
        backgroundColor: "#f3f3f3",
        scale: 2,
        useCORS: true,
        windowWidth: captureWidth,
      });

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );

      if (!blob) {
        throw new Error("Unable to create image blob.");
      }

      const downloadPng = () => {
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `meeting-schedule-${weekStart}.png`;
        link.click();
      };

      if (
        navigator.clipboard?.write &&
        typeof window.ClipboardItem !== "undefined"
      ) {
        try {
          await navigator.clipboard.write([
            new window.ClipboardItem({ "image/png": blob }),
          ]);
          showToast("Meeting schedule copied as image.");
          return;
        } catch (clipboardError) {
          if (clipboardError?.name === "NotAllowedError") {
            downloadPng();
            showToast("Clipboard blocked. Downloaded PNG instead.");
            return;
          }
          throw clipboardError;
        }
      }

      downloadPng();
      showToast("Clipboard image copy is not supported. Downloaded PNG instead.");
    } catch (error) {
      console.error(error);
      showToast("Failed to copy schedule image.");
    } finally {
      if (captureWrapper.parentNode) {
        captureWrapper.parentNode.removeChild(captureWrapper);
      }
      setCopyingSchedule(false);
    }
  }

  return (
    <>
      {isLoadingData && <FullscreenLoader text="Loading schedule…" />}
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

          <div className="d-flex align-items-center gap-2">
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={handleCopyScheduleImage}
              disabled={copyingSchedule}
              title="Copy schedule as image"
            >
              <i className="fas fa-copy"></i>
            </button>

            {canEdit && (
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setViewMode((v) => !v)}
              >
                {viewMode ? "Switch to Edit" : "Switch to View"}
              </button>
            )}
          </div>
        </div>

        {isPastWeek && !viewOnly && (
          <div className="alert alert-warning py-2">
            Past schedules are view-only and cannot be edited.
          </div>
        )}

        {!hasWeeklySchedule && (
          <div className="alert alert-info py-2">
            No schedule data has been set for this week yet.
          </div>
        )}

        {/* TABLE */}
        {hasWeeklySchedule ? (
          <>
            <div ref={scheduleCaptureRef} className="schedule-details-wrap">
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
            </div>

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
          </>
        ) : null}
      </div>
    </>
  );
}
