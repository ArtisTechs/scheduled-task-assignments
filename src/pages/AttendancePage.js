import { useEffect, useMemo, useState } from "react";
import { Dropdown, Modal } from "react-bootstrap";

import FullscreenLoader from "../components/FullscreenLoader";
import {
  addAttendanceRecord,
  deleteAttendanceRecordById,
  fetchAttendanceRecords,
  updateAttendanceRecord,
} from "../shared/services/attendance.firestore";

const MONTH_OPTIONS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const PERIOD_OPTIONS = [
  { value: "all", label: "All" },
  { value: "midweek", label: "Midweek" },
  { value: "weekend", label: "Weekend" },
];

function getCurrentMonthPeriod(baseDate = new Date()) {
  const currentMonthDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  return {
    month: currentMonthDate.getMonth() + 1,
    year: currentMonthDate.getFullYear(),
  };
}

function monthLabel(monthNumber) {
  if (!monthNumber) return "-";
  return MONTH_OPTIONS.find((option) => option.value === monthNumber)?.label || "-";
}

function toInputDateValue(date) {
  if (!date) return "";
  const instance = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(instance.getTime())) return "";
  const year = instance.getFullYear();
  const month = String(instance.getMonth() + 1).padStart(2, "0");
  const day = String(instance.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return "-";
  return value.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function typeLabel(type) {
  if (type === "midweek") return "Midweek";
  if (type === "weekend") return "Weekend";
  return "-";
}

function typeBadgeClass(type) {
  if (type === "midweek") return "text-bg-primary";
  if (type === "weekend") return "text-bg-success";
  return "text-bg-secondary";
}

function getDefaultForm() {
  return {
    date: "",
    attendanceType: "midweek",
    videoConferencingAttendance: "",
    kingdomHallAttendance: "",
  };
}

export default function AttendancePage() {
  const defaultPeriod = getCurrentMonthPeriod();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingText, setSavingText] = useState("Saving attendance record...");
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(defaultPeriod.month);
  const [selectedYear, setSelectedYear] = useState(defaultPeriod.year);
  const [periodFilter, setPeriodFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [form, setForm] = useState(getDefaultForm());
  const [formErrorMessage, setFormErrorMessage] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function initializePage() {
      setLoading(true);
      setError("");

      try {
        const data = await fetchAttendanceRecords();
        if (!mounted) return;
        setRecords(data);
      } catch (err) {
        if (!mounted) return;
        if (err?.code === "permission-denied") {
          setError(
            "Missing Firestore permission for collection 'attendance_records'. Update Firestore rules and try again."
          );
        } else {
          setError(err?.message || "Failed to load attendance records.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initializePage();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredRecords = useMemo(() => {
    return [...records]
      .filter((record) => {
        if (!record.date) return false;
        if (record.month !== selectedMonth) return false;
        if (record.year !== selectedYear) return false;
        if (periodFilter !== "all" && record.attendanceType !== periodFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = a.date ? a.date.getTime() : 0;
        const dateB = b.date ? b.date.getTime() : 0;
        return dateB - dateA;
      });
  }, [periodFilter, records, selectedMonth, selectedYear]);

  const yearOptions = useMemo(() => {
    const yearsFromData = records
      .map((record) => record.year)
      .filter((year) => Number.isFinite(year));

    const years = new Set(yearsFromData);
    years.add(defaultPeriod.year - 1);
    years.add(defaultPeriod.year);
    years.add(defaultPeriod.year + 1);

    return [...years].sort((a, b) => b - a);
  }, [defaultPeriod.year, records]);

  const totalAttendance = useMemo(() => {
    return filteredRecords.reduce((sum, record) => {
      const value = Number(record.totalAttendance);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
  }, [filteredRecords]);

  const averageAttendance = useMemo(() => {
    if (filteredRecords.length === 0) return 0;
    return totalAttendance / filteredRecords.length;
  }, [filteredRecords.length, totalAttendance]);

  const averageVideoConferencingAttendance = useMemo(() => {
    if (filteredRecords.length === 0) return 0;
    const total = filteredRecords.reduce((sum, record) => {
      const value = Number(record.videoConferencingAttendance);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
    return total / filteredRecords.length;
  }, [filteredRecords]);

  const averageKingdomHallAttendance = useMemo(() => {
    if (filteredRecords.length === 0) return 0;
    const total = filteredRecords.reduce((sum, record) => {
      const value = Number(record.kingdomHallAttendance);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
    return total / filteredRecords.length;
  }, [filteredRecords]);

  const selectedMonthLabel = monthLabel(selectedMonth);

  function reloadRecords() {
    return fetchAttendanceRecords().then((data) => setRecords(data));
  }

  function resetForm() {
    setEditingRecordId(null);
    setForm(getDefaultForm());
    setFormErrors({});
    setFormErrorMessage("");
    setRecordToDelete(null);
  }

  function openCreateModal() {
    resetForm();
    setForm({
      ...getDefaultForm(),
      date: toInputDateValue(new Date()),
    });
    setShowCreateModal(true);
  }

  function closeCreateModal(force = false) {
    if (saving && !force) return;
    setShowCreateModal(false);
    resetForm();
  }

  function openEditModal(record) {
    setEditingRecordId(record.id);
    setForm({
      date: toInputDateValue(record.date),
      attendanceType: record.attendanceType || "midweek",
      videoConferencingAttendance: record.videoConferencingAttendance ?? "",
      kingdomHallAttendance: record.kingdomHallAttendance ?? "",
    });
    setFormErrors({});
    setFormErrorMessage("");
    setShowCreateModal(true);
  }

  function openDeleteModal(record) {
    setRecordToDelete(record);
    setShowDeleteModal(true);
  }

  function closeDeleteModal(force = false) {
    if (saving && !force) return;
    setShowDeleteModal(false);
    setRecordToDelete(null);
  }

  function onFormChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function getComputedTotal() {
    const videoConferencing = Number(form.videoConferencingAttendance);
    const kingdomHall = Number(form.kingdomHallAttendance);
    if (!Number.isFinite(videoConferencing) || !Number.isFinite(kingdomHall)) return "";
    return videoConferencing + kingdomHall;
  }

  async function handleSaveRecord() {
    setFormErrorMessage("");

    const nextErrors = {};
    const dateValue = String(form.date || "").trim();
    const videoConferencingValue = Number(form.videoConferencingAttendance);
    const kingdomHallValue = Number(form.kingdomHallAttendance);

    if (!dateValue) nextErrors.date = "Date is required.";
    if (!form.attendanceType) nextErrors.attendanceType = "Please choose a type.";

    if (!String(form.videoConferencingAttendance).trim()) {
      nextErrors.videoConferencingAttendance = "Video conferencing attendance is required.";
    } else if (!Number.isFinite(videoConferencingValue) || videoConferencingValue < 0) {
      nextErrors.videoConferencingAttendance =
        "Video conferencing attendance must be 0 or greater.";
    }

    if (!String(form.kingdomHallAttendance).trim()) {
      nextErrors.kingdomHallAttendance = "Kingdom Hall attendance is required.";
    } else if (!Number.isFinite(kingdomHallValue) || kingdomHallValue < 0) {
      nextErrors.kingdomHallAttendance = "Kingdom Hall attendance must be 0 or greater.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      setFormErrorMessage("Please fix the highlighted form errors.");
      return;
    }

    setSaving(true);
    setSavingText(
      editingRecordId ? "Updating attendance record..." : "Saving attendance record..."
    );

    try {
      const payload = {
        date: new Date(`${form.date}T00:00:00`),
        attendanceType: form.attendanceType,
        videoConferencingAttendance: videoConferencingValue,
        kingdomHallAttendance: kingdomHallValue,
        totalAttendance: videoConferencingValue + kingdomHallValue,
      };

      if (editingRecordId) {
        await updateAttendanceRecord(editingRecordId, payload);
      } else {
        await addAttendanceRecord(payload);
      }

      await reloadRecords();
      closeCreateModal(true);
    } catch (err) {
      if (err?.code === "permission-denied") {
        setFormErrorMessage(
          "Missing Firestore permission for collection 'attendance_records'. Update Firestore rules and try again."
        );
      } else {
        setFormErrorMessage(
          err?.message ||
            `Failed to ${editingRecordId ? "update" : "create"} attendance record.`
        );
      }
    } finally {
      setSaving(false);
      setSavingText("Saving attendance record...");
    }
  }

  async function handleDeleteRecord() {
    if (!recordToDelete?.id) return;

    setSaving(true);
    setSavingText("Deleting attendance record...");
    try {
      await deleteAttendanceRecordById(recordToDelete.id);
      await reloadRecords();
      closeDeleteModal(true);
    } catch (err) {
      if (err?.code === "permission-denied") {
        setError(
          "Missing Firestore permission for collection 'attendance_records'. Update Firestore rules and try again."
        );
      } else {
        setError(err?.message || "Failed to delete attendance record.");
      }
    } finally {
      setSaving(false);
      setSavingText("Saving attendance record...");
    }
  }

  return (
    <>
      {(loading || saving) && (
        <FullscreenLoader
          text={saving ? savingText : "Loading attendance records..."}
        />
      )}

      <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
        <h4 className="mb-0">Attendance</h4>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          Create Attendance
        </button>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="card p-3 mb-3">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-4">
            <label htmlFor="attendance-month" className="form-label mb-1">
              Month
            </label>
            <select
              id="attendance-month"
              className="form-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
              {MONTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-4">
            <label htmlFor="attendance-year" className="form-label mb-1">
              Year
            </label>
            <select
              id="attendance-year"
              className="form-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-4">
            <label htmlFor="attendance-period" className="form-label mb-1">
              Midweek / Weekend
            </label>
            <select
              id="attendance-period"
              className="form-select"
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <span className="badge text-bg-primary fs-6">
          {selectedMonthLabel} {selectedYear}
        </span>
        <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
          <span className="badge text-bg-secondary fs-6">
            Total Entries: {filteredRecords.length}
          </span>
          <span className="badge text-bg-secondary fs-6">
            Average Video Conferencing: {averageVideoConferencingAttendance.toFixed(1)}
          </span>
          <span className="badge text-bg-secondary fs-6">
            Average Kingdom Hall: {averageKingdomHallAttendance.toFixed(1)}
          </span>
          <span className="badge text-bg-secondary fs-6">
            Total Attendance: {totalAttendance}
          </span>
          <span className="badge text-bg-secondary fs-6">
            Average: {filteredRecords.length ? averageAttendance.toFixed(1) : "0.0"}
          </span>
        </div>
      </div>

      <div className="table-responsive list-items-scroll attendance-list-scroll">
        <table className="table table-striped table-hover align-middle">
          <thead className="table-dark">
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Type</th>
              <th scope="col">Video Conferencing</th>
              <th scope="col">Kingdom Hall</th>
              <th scope="col">Total</th>
              <th scope="col" className="text-end">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-4 text-muted">
                  No attendance records found for {selectedMonthLabel} {selectedYear}.
                </td>
              </tr>
            ) : (
              filteredRecords.map((record) => (
                <tr key={record.id}>
                  <td>{formatDisplayDate(record.date)}</td>
                  <td>
                    <span className={`badge ${typeBadgeClass(record.attendanceType)}`}>
                      {typeLabel(record.attendanceType)}
                    </span>
                  </td>
                  <td>{record.videoConferencingAttendance ?? "-"}</td>
                  <td>{record.kingdomHallAttendance ?? "-"}</td>
                  <td>{record.totalAttendance ?? "-"}</td>
                  <td className="text-end">
                    <Dropdown align="end">
                      <Dropdown.Toggle
                        variant="link"
                        className="text-dark p-0 border-0 shadow-none"
                        id={`attendance-actions-${record.id}`}
                      >
                        <i className="fas fa-ellipsis-v"></i>
                      </Dropdown.Toggle>
                      <Dropdown.Menu>
                        <Dropdown.Item onClick={() => openEditModal(record)}>
                          Edit
                        </Dropdown.Item>
                        <Dropdown.Item
                          className="text-danger"
                          onClick={() => openDeleteModal(record)}
                        >
                          Delete
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal show={showCreateModal} onHide={closeCreateModal} centered>
        <Modal.Header closeButton={!saving}>
          <Modal.Title>
            {editingRecordId ? "Edit Attendance" : "Create Attendance"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formErrorMessage && (
            <div className="alert alert-danger py-2">{formErrorMessage}</div>
          )}

          <div className="mb-3">
            <label htmlFor="attendance-date" className="form-label mb-1">
              Date
            </label>
            <input
              id="attendance-date"
              type="date"
              className={`form-control ${formErrors.date ? "is-invalid" : ""}`}
              value={form.date}
              onChange={(e) => onFormChange("date", e.target.value)}
            />
            {formErrors.date && <div className="invalid-feedback">{formErrors.date}</div>}
          </div>

          <div className="mb-3">
            <label htmlFor="attendance-type" className="form-label mb-1">
              Midweek / Weekend
            </label>
            <select
              id="attendance-type"
              className={`form-select ${
                formErrors.attendanceType ? "is-invalid" : ""
              }`}
              value={form.attendanceType}
              onChange={(e) => onFormChange("attendanceType", e.target.value)}
            >
              <option value="midweek">Midweek</option>
              <option value="weekend">Weekend</option>
            </select>
            {formErrors.attendanceType && (
              <div className="invalid-feedback d-block">
                {formErrors.attendanceType}
              </div>
            )}
          </div>

          <div className="mb-3">
            <label htmlFor="attendance-video-conferencing" className="form-label mb-1">
              Video Conferencing Attendance
            </label>
            <input
              id="attendance-video-conferencing"
              type="number"
              min="0"
              step="1"
              className={`form-control ${
                formErrors.videoConferencingAttendance ? "is-invalid" : ""
              }`}
              value={form.videoConferencingAttendance}
              onChange={(e) =>
                onFormChange("videoConferencingAttendance", e.target.value)
              }
            />
            {formErrors.videoConferencingAttendance && (
              <div className="invalid-feedback">
                {formErrors.videoConferencingAttendance}
              </div>
            )}
          </div>

          <div className="mb-3">
            <label htmlFor="attendance-kingdom-hall" className="form-label mb-1">
              Kingdom Hall Attendance
            </label>
            <input
              id="attendance-kingdom-hall"
              type="number"
              min="0"
              step="1"
              className={`form-control ${
                formErrors.kingdomHallAttendance ? "is-invalid" : ""
              }`}
              value={form.kingdomHallAttendance}
              onChange={(e) => onFormChange("kingdomHallAttendance", e.target.value)}
            />
            {formErrors.kingdomHallAttendance && (
              <div className="invalid-feedback">
                {formErrors.kingdomHallAttendance}
              </div>
            )}
          </div>

          <div className="alert alert-info py-2 mb-0">
            Auto total: <strong>{getComputedTotal() || 0}</strong>
            <div className="small mb-0">The total is calculated and saved online.</div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={closeCreateModal}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSaveRecord}
            disabled={saving}
          >
            {editingRecordId ? "Update Attendance" : "Save Attendance"}
          </button>
        </Modal.Footer>
      </Modal>

      <Modal show={showDeleteModal} onHide={closeDeleteModal} centered>
        <Modal.Header closeButton={!saving}>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Delete attendance record for{" "}
          <strong>
            {recordToDelete ? formatDisplayDate(recordToDelete.date) : "this record"}
          </strong>
          ?
          <div className="small text-muted mt-2">This action cannot be undone.</div>
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={closeDeleteModal}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDeleteRecord}
            disabled={saving}
          >
            Delete
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
