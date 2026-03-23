import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import {
  addDays,
  formatDateLong,
  getWeekRange,
  getWeekStart,
} from "../shared/services/schedule-assignment.service";
import { fetchAllSchedulesAndCache } from "../shared/services/schedule.firestore";
import { MINISTERYO_RULES, ROLES, SCHEDULE_TEMPLATE } from "../shared/constants";
import { STORAGE_KEYS } from "../shared/keys/storage.keys";
import { showToast } from "../shared/services/toast.service";

const CBS_KEY = "CBS";
const STUDENT_CARD_ROLES = [
  ROLES.STUDENT,
  ROLES.STUDENT_PAHAYAG,
  ROLES.BIBLE_READER,
];
const COPY_PADDING_PX = 28;
const COPY_FOCUS_WAIT_MS = 1500;
const COPY_EXPORT_CAPTURE_WIDTH_PX = 452;
const COPY_EXPORT_VIEWPORT_WIDTH_PX = 1200;

function createDefaultLocations() {
  return {
    mainHall: true,
    aux1: false,
    aux2: false,
  };
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

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
        (section) => section.key === tplSection.key
      );

      return {
        ...tplSection,
        ...(loadedSection || {}),
        items: loadedSection?.items ?? structuredClone(tplSection.items),
      };
    }),
  };

  const ministryTitleMigration = {
    "Ipaliwanag ang Paniniwala mo":
      "Ipaliwanag ang Paniniwala Mo - Pagtatanghal",
  };

  const ministeryoSection = normalized.sections.find(
    (section) => section.key === "MINISTERYO"
  );

  ministeryoSection?.items?.forEach((item) => {
    const migratedTitle = ministryTitleMigration[item.title];
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

function getPamumuhayItems(section) {
  const cbs = section?.items?.find((item) => item.key === CBS_KEY);
  const others = (section?.items || []).filter((item) => item.key !== CBS_KEY);
  return cbs ? [...others, cbs] : others;
}

function getCardDateRange(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "-";
  }

  const startMonth = startDate.toLocaleDateString("en-US", { month: "long" });
  const endMonth = endDate.toLocaleDateString("en-US", { month: "long" });
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  }

  return `${startMonth} ${startDay}-${endMonth} ${endDay}`;
}

function buildStudentCardParts(schedule, personNames) {
  const parts = [];
  let partNumber = 1;

  (schedule.sections || []).forEach((section) => {
    const items =
      section.key === "PAMUMUHAY" ? getPamumuhayItems(section) : section.items;

    (items || []).forEach((item) => {
      const allowedRoles = Array.isArray(item.allowedRoles)
        ? item.allowedRoles
        : [];
      const isStudentCardPart = allowedRoles.some((role) =>
        STUDENT_CARD_ROLES.includes(role)
      );

      const assignees = Array.isArray(item.assignees)
        ? item.assignees.filter(Boolean)
        : [];

      if (isStudentCardPart && assignees.length > 0) {
        parts.push({
          id: `${section.key}-${item.key}-${partNumber}`,
          partNumber,
          title: item.title || "",
          studentName: personNames.get(assignees[0]) || "-",
          assistantName: personNames.get(assignees[1]) || "-",
        });
      }

      partNumber += 1;
    });
  });

  return parts;
}

function waitForDocumentFocus(timeoutMs = COPY_FOCUS_WAIT_MS) {
  if (document.hasFocus()) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;

    function done(value) {
      if (settled) return;
      settled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearTimeout(timer);
      resolve(value);
    }

    function onFocus() {
      done(true);
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible" && document.hasFocus()) {
        done(true);
      }
    }

    const timer = setTimeout(() => done(document.hasFocus()), timeoutMs);

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    try {
      window.focus();
    } catch {
      // ignore
    }
  });
}

export default function StudentAssignmentCardPage({ persons = [] }) {
  const today = new Date().toISOString().substring(0, 10);

  const [selectedDate, setSelectedDate] = useState(today);
  const [weekStart, setWeekStart] = useState(getWeekStart(today));
  const [weekRange, setWeekRange] = useState(getWeekRange(weekStart));
  const [schedule, setSchedule] = useState(structuredClone(SCHEDULE_TEMPLATE));
  const [personList, setPersonList] = useState([]);
  const [partIndex, setPartIndex] = useState(0);
  const [partLocations, setPartLocations] = useState({});
  const [copyingCard, setCopyingCard] = useState(false);
  const [loading, setLoading] = useState(false);
  const cardCaptureRef = useRef(null);

  useEffect(() => {
    const ws = getWeekStart(selectedDate);
    setWeekStart(ws);
    setWeekRange(getWeekRange(ws));
  }, [selectedDate]);

  useEffect(() => {
    if (Array.isArray(persons) && persons.length > 0) {
      setPersonList(persons);
      return;
    }

    const raw = localStorage.getItem(STORAGE_KEYS.PERSONS);
    setPersonList(raw ? parseJson(raw, []) || [] : []);
  }, [persons]);

  useEffect(() => {
    setPartIndex(0);
    setPartLocations({});
  }, [weekStart]);

  useEffect(() => {
    let mounted = true;

    async function loadWeekSchedule() {
      setLoading(true);

      try {
        let allSchedules = {};
        const raw = localStorage.getItem(STORAGE_KEYS.SCHEDULES);

        if (raw) {
          allSchedules = parseJson(raw, {}) || {};
        } else {
          allSchedules = await fetchAllSchedulesAndCache();
        }

        const weeklySchedule = allSchedules[weekStart];
        if (!mounted) return;

        setSchedule(
          weeklySchedule
            ? normalizeSchedule(weeklySchedule)
            : structuredClone(SCHEDULE_TEMPLATE)
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadWeekSchedule();

    return () => {
      mounted = false;
    };
  }, [weekStart]);

  const personNames = useMemo(() => {
    return new Map(personList.map((person) => [person.id, person.name]));
  }, [personList]);

  const parts = useMemo(() => {
    return buildStudentCardParts(schedule, personNames);
  }, [schedule, personNames]);

  useEffect(() => {
    if (parts.length === 0) {
      setPartIndex(0);
      return;
    }

    setPartIndex((current) => Math.min(current, parts.length - 1));
  }, [parts]);

  const activePart = parts[partIndex] || null;
  const activePartLocations = activePart
    ? partLocations[activePart.id] || createDefaultLocations()
    : createDefaultLocations();

  function handleLocationToggle(locationKey, checked) {
    if (!activePart) return;

    setPartLocations((current) => {
      const existing = current[activePart.id] || createDefaultLocations();
      return {
        ...current,
        [activePart.id]: {
          ...existing,
          [locationKey]: checked,
        },
      };
    });
  }

  async function handleCopyCardImage() {
    if (!cardCaptureRef.current) return;

    setCopyingCard(true);
    const sourceNode = cardCaptureRef.current;
    const sourceCheckboxes = Array.from(
      sourceNode.querySelectorAll('input[type="checkbox"]')
    );
    const captureWrapper = document.createElement("div");
    const clonedNode = sourceNode.cloneNode(true);
    const cloneCheckboxes = Array.from(
      clonedNode.querySelectorAll('input[type="checkbox"]')
    );

    try {
      captureWrapper.style.position = "fixed";
      captureWrapper.style.left = "-10000px";
      captureWrapper.style.top = "0";
      captureWrapper.style.padding = `${COPY_PADDING_PX}px`;
      captureWrapper.style.background = "#f3f3f3";
      captureWrapper.style.boxSizing = "border-box";
      captureWrapper.style.width = `${COPY_EXPORT_CAPTURE_WIDTH_PX + COPY_PADDING_PX * 2}px`;

      // Keep copy output stable across desktop/mobile viewport sizes.
      clonedNode.style.width = `${COPY_EXPORT_CAPTURE_WIDTH_PX}px`;
      clonedNode.style.minWidth = `${COPY_EXPORT_CAPTURE_WIDTH_PX}px`;
      clonedNode.style.maxWidth = "none";

      cloneCheckboxes.forEach((cloneInput, index) => {
        const sourceInput = sourceCheckboxes[index];
        if (!sourceInput) return;
        cloneInput.checked = sourceInput.checked;
      });

      captureWrapper.appendChild(clonedNode);
      document.body.appendChild(captureWrapper);

      const canvas = await html2canvas(captureWrapper, {
        backgroundColor: "#f3f3f3",
        scale: 2,
        useCORS: true,
        windowWidth: COPY_EXPORT_VIEWPORT_WIDTH_PX,
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
        link.download = `student-assignment-part-${activePart?.partNumber || "card"}.png`;
        link.click();
      };

      if (navigator.clipboard?.write && typeof window.ClipboardItem !== "undefined") {
        const hasFocus = document.hasFocus() || (await waitForDocumentFocus());
        if (!hasFocus) {
          downloadPng();
          showToast("Window is not focused. Downloaded PNG instead.");
          return;
        }

        try {
          await navigator.clipboard.write([
            new window.ClipboardItem({ "image/png": blob }),
          ]);
          showToast("Card copied as image.");
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
      showToast("Failed to copy card image.");
    } finally {
      if (captureWrapper.parentNode) {
        captureWrapper.parentNode.removeChild(captureWrapper);
      }
      setCopyingCard(false);
    }
  }

  return (
    <div className="container mt-3 student-assignment-page">
      <div className="d-flex align-items-center gap-2 mb-2">
        <button
          className="btn btn-outline-secondary"
          onClick={() => setSelectedDate((date) => addDays(date, -7))}
        >
          <i className="fas fa-chevron-left"></i>
        </button>

        <input
          type="date"
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
          className="form-control w-auto"
        />

        <button
          className="btn btn-outline-secondary"
          onClick={() => setSelectedDate((date) => addDays(date, 7))}
        >
          <i className="fas fa-chevron-right"></i>
        </button>
      </div>

      <div className="alert alert-light border fw-semibold mb-3 week-range">
        Week: <span className="fw-bold fs-5">{formatDateLong(weekRange.start)}</span>
        {" - "}
        <span className="fw-bold fs-5">{formatDateLong(weekRange.end)}</span>
      </div>

      {loading && <div className="alert alert-light border">Loading schedule...</div>}

      {!loading && !activePart && (
        <div className="alert alert-info border">
          No assigned student or bible student parts for this week.
        </div>
      )}

      {!loading && activePart && (
        <>
          <div className="student-assignment-card mx-auto">
            <div className="student-assignment-card-top">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary student-assignment-copy-btn"
                onClick={handleCopyCardImage}
                disabled={copyingCard}
                title="Copy card as image"
              >
                <i className="fas fa-copy"></i>
              </button>
            </div>

            <div ref={cardCaptureRef} className="student-assignment-card-capture">
              <h3 className="student-assignment-title">
                OUR CHRISTIAN LIFE AND MINISTRY
                <br />
                MEETING ASSIGNMENT
              </h3>

              <div className="student-assignment-field">
                <span className="student-assignment-label">Name:</span>
                <span className="student-assignment-value">
                  {activePart.studentName}
                </span>
              </div>

              <div className="student-assignment-field">
                <span className="student-assignment-label">Assistant:</span>
                <span className="student-assignment-value">
                  {activePart.assistantName}
                </span>
              </div>

              <div className="student-assignment-field">
                <span className="student-assignment-label">Date:</span>
                <span className="student-assignment-value">
                  {getCardDateRange(weekRange.start, weekRange.end)}
                </span>
              </div>

              <div className="student-assignment-field">
                <span className="student-assignment-label">Part no.:</span>
                <span className="student-assignment-value">
                  {activePart.partNumber}. {activePart.title}
                </span>
              </div>

              <div className="student-assignment-location-block">
                <p className="mb-2 fw-bold">To be given in:</p>

                <div className="form-check">
                  <input
                    id={`location-main-hall-${activePart.id}`}
                    className="form-check-input"
                    type="checkbox"
                    checked={activePartLocations.mainHall}
                    onChange={(event) =>
                      handleLocationToggle("mainHall", event.target.checked)
                    }
                  />
                  <label
                    className="form-check-label"
                    htmlFor={`location-main-hall-${activePart.id}`}
                  >
                    Main hall
                  </label>
                </div>

                <div className="form-check">
                  <input
                    id={`location-aux-1-${activePart.id}`}
                    className="form-check-input"
                    type="checkbox"
                    checked={activePartLocations.aux1}
                    onChange={(event) =>
                      handleLocationToggle("aux1", event.target.checked)
                    }
                  />
                  <label
                    className="form-check-label"
                    htmlFor={`location-aux-1-${activePart.id}`}
                  >
                    Auxiliary classroom 1
                  </label>
                </div>

                <div className="form-check">
                  <input
                    id={`location-aux-2-${activePart.id}`}
                    className="form-check-input"
                    type="checkbox"
                    checked={activePartLocations.aux2}
                    onChange={(event) =>
                      handleLocationToggle("aux2", event.target.checked)
                    }
                  />
                  <label
                    className="form-check-label"
                    htmlFor={`location-aux-2-${activePart.id}`}
                  >
                    Auxiliary classroom 2
                  </label>
                </div>
              </div>

              <p className="student-assignment-note">
                <strong>Note to student:</strong> The source material and study point
                for your assignment can be found in the <em>Life and Ministry
                Meeting Workbook</em>. Please review the instructions for the part as
                outlined in <em>Instructions for Our Christian Life and Ministry</em>{" "}
                (S-38).
              </p>

              <small className="text-muted">S-89-E 11/23</small>
            </div>
          </div>

          <div className="student-assignment-nav mt-3">
            <button
              className="btn btn-outline-secondary student-assignment-nav-btn"
              onClick={() => setPartIndex((index) => Math.max(index - 1, 0))}
              disabled={partIndex === 0}
            >
              <i className="fas fa-chevron-left me-1"></i>
              Previous
            </button>

            <span className="fw-semibold student-assignment-nav-status">
              Part {partIndex + 1} of {parts.length}
            </span>

            <button
              className="btn btn-outline-secondary student-assignment-nav-btn"
              onClick={() =>
                setPartIndex((index) => Math.min(index + 1, parts.length - 1))
              }
              disabled={partIndex >= parts.length - 1}
            >
              Next
              <i className="fas fa-chevron-right ms-1"></i>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
