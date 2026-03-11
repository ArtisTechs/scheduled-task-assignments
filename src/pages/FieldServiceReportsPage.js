import { forwardRef, useEffect, useMemo, useState } from "react";
import { Dropdown, Modal } from "react-bootstrap";
import FullscreenLoader from "../components/FullscreenLoader";
import { fetchCongregationPersons } from "../shared/services/congregation-persons.firestore";
import {
  addFieldServiceReport,
  deleteFieldServiceReportById,
  fetchFieldServiceReports,
  updateFieldServiceReport,
} from "../shared/services/field-service-reports.firestore";

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
const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "regular_pioneer", label: "Regular Pioneer" },
  { value: "auxiliary_pioneer", label: "Auxilliary Pioneer" },
  { value: "publisher", label: "Publisher" },
];
const DEFAULT_MONTH = new Date().getMonth() + 1;
const DEFAULT_YEAR = new Date().getFullYear();

function booleanLabel(value) {
  return value ? "Yes" : "No";
}

function monthLabel(monthNumber) {
  if (!monthNumber) return "-";
  return MONTH_OPTIONS.find((option) => option.value === monthNumber)?.label || "-";
}

function reportStatusKey(report) {
  if (report?.regularPioneer) return "regular_pioneer";
  if (report?.auxiliaryPioneer) return "auxiliary_pioneer";
  return "publisher";
}

function reportStatusLabel(report) {
  const status = reportStatusKey(report);
  if (status === "regular_pioneer") return "Regular Pioneer";
  if (status === "auxiliary_pioneer") return "Auxilliary Pioneer";
  return "Publisher";
}

const INITIAL_FORM = {
  auxiliaryPioneer: false,
  sharedMinistry: true,
  hours: "",
  bibleStudies: "0",
};

const KebabToggle = forwardRef(function KebabToggle({ onClick }, ref) {
  return (
    <button
      type="button"
      className="btn btn-link text-dark p-0 border-0 shadow-none"
      ref={ref}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick(e);
      }}
      aria-label="Row actions"
      title="Actions"
    >
      <i className="fas fa-ellipsis-v"></i>
    </button>
  );
});

export default function FieldServiceReportsPage() {
  const [reports, setReports] = useState([]);
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingText, setSavingText] = useState("Saving field service report...");
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(DEFAULT_MONTH);
  const [selectedYear, setSelectedYear] = useState(DEFAULT_YEAR);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingReportId, setEditingReportId] = useState(null);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [personSearch, setPersonSearch] = useState("");
  const [form, setForm] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formErrorMessage, setFormErrorMessage] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function initializePage() {
      setLoading(true);
      setError("");

      try {
        const [reportsData, congregationPersons] = await Promise.all([
          fetchFieldServiceReports(),
          fetchCongregationPersons(),
        ]);

        if (!mounted) return;

        setReports(reportsData);
        setPersons(
          congregationPersons.filter(
            (person) => String(person.status || "").toLowerCase() !== "removed"
          )
        );

        const hasCurrentPeriodData = reportsData.some(
          (report) => report.month === DEFAULT_MONTH && report.year === DEFAULT_YEAR
        );
        if (!hasCurrentPeriodData) {
          const latestDatedReport = reportsData.find(
            (report) => report.month && report.year
          );
          if (latestDatedReport) {
            setSelectedMonth(latestDatedReport.month);
            setSelectedYear(latestDatedReport.year);
          }
        }
      } catch (err) {
        if (!mounted) return;
        if (err?.code === "permission-denied") {
          setError(
            "Missing Firestore permission for 'field_service_reports' or 'congregation_persons'. Update Firestore rules and try again."
          );
        } else {
          setError(err?.message || "Failed to load field service reports.");
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

  const selectedPerson = useMemo(() => {
    return persons.find((person) => person.id === selectedPersonId) || null;
  }, [persons, selectedPersonId]);

  const isRegularPioneer = Boolean(selectedPerson?.regularPioneer);
  const isAuxiliaryPioneer = !isRegularPioneer && form.auxiliaryPioneer;
  const requiresHours = isRegularPioneer || isAuxiliaryPioneer;
  const showSharedCheckbox = !isRegularPioneer && !isAuxiliaryPioneer;

  const computedSharedMinistry = useMemo(() => {
    if (showSharedCheckbox) return form.sharedMinistry;
    return Number(form.hours) > 0;
  }, [form.hours, form.sharedMinistry, showSharedCheckbox]);

  const filteredPersonOptions = useMemo(() => {
    const normalizedSearch = personSearch.trim().toLowerCase();
    if (!normalizedSearch) return persons;
    return persons.filter((person) =>
      String(person.name || "").toLowerCase().includes(normalizedSearch)
    );
  }, [persons, personSearch]);

  const yearOptions = useMemo(() => {
    const yearsFromData = reports
      .map((report) => report.year)
      .filter((year) => Number.isFinite(year));

    const years = new Set(yearsFromData);
    years.add(DEFAULT_YEAR - 1);
    years.add(DEFAULT_YEAR);
    years.add(DEFAULT_YEAR + 1);

    return [...years].sort((a, b) => b - a);
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      if (report.month !== selectedMonth) return false;
      if (report.year !== selectedYear) return false;
      if (statusFilter !== "all" && reportStatusKey(report) !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [reports, selectedMonth, selectedYear, statusFilter]);
  const totalHours = useMemo(() => {
    return filteredReports.reduce((sum, report) => {
      const hours = Number(report.hours);
      return Number.isFinite(hours) ? sum + hours : sum;
    }, 0);
  }, [filteredReports]);
  const totalBibleStudies = useMemo(() => {
    return filteredReports.reduce((sum, report) => {
      const studies = Number(report.bibleStudies);
      return Number.isFinite(studies) ? sum + studies : sum;
    }, 0);
  }, [filteredReports]);

  const selectedMonthLabel = monthLabel(selectedMonth);

  async function reloadReports() {
    const data = await fetchFieldServiceReports();
    setReports(data);
  }

  function resetCreateForm() {
    setSelectedPersonId("");
    setPersonSearch("");
    setForm(INITIAL_FORM);
    setFormErrors({});
    setFormErrorMessage("");
    setEditingReportId(null);
  }

  function openCreateModal() {
    resetCreateForm();
    setShowCreateModal(true);
  }

  function closeCreateModal(force = false) {
    if (saving && !force) return;
    setShowCreateModal(false);
    resetCreateForm();
  }

  function openEditModal(report) {
    const matchedPerson =
      persons.find((person) => person.id === report.personId) ||
      persons.find((person) => person.name === report.personName) ||
      null;

    setEditingReportId(report.id);
    setSelectedPersonId(matchedPerson?.id || "");
    setPersonSearch(matchedPerson?.name || report.personName || "");
    setForm({
      auxiliaryPioneer: Boolean(report.auxiliaryPioneer),
      sharedMinistry: Boolean(report.sharedMinistry),
      hours: report.hours ?? "",
      bibleStudies: String(report.bibleStudies ?? 0),
    });
    setFormErrors({});
    setFormErrorMessage("");
    setShowCreateModal(true);
  }

  function handlePersonSearchChange(value) {
    setPersonSearch(value);
    setSelectedPersonId("");
    setForm((prev) => ({
      ...prev,
      auxiliaryPioneer: false,
      sharedMinistry: true,
      hours: "",
    }));
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.personId;
      return next;
    });
  }

  function handlePersonSelect(person) {
    setSelectedPersonId(person.id);
    setPersonSearch(person.name || "");
    setForm((prev) => ({
      ...prev,
      auxiliaryPioneer: false,
      sharedMinistry: true,
      hours: "",
    }));
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.personId;
      return next;
    });
  }

  function clearSelectedPerson() {
    handlePersonSearchChange("");
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

  function openDeleteModal(report) {
    setReportToDelete(report);
    setShowDeleteModal(true);
  }

  function closeDeleteModal(force = false) {
    if (saving && !force) return;
    setShowDeleteModal(false);
    setReportToDelete(null);
  }

  async function handleSaveReport() {
    setFormErrorMessage("");

    const nextErrors = {};
    const selected = selectedPerson;
    if (!selected) {
      nextErrors.personId = "Please choose a person from the list.";
    }

    const hoursValue = Number(form.hours);
    if (requiresHours) {
      if (!String(form.hours).trim()) {
        nextErrors.hours = "Hours are required.";
      } else if (!Number.isFinite(hoursValue) || hoursValue <= 0) {
        nextErrors.hours = "Hours must be greater than 0.";
      }
    }

    const bibleStudiesRaw = String(form.bibleStudies).trim();
    const bibleStudiesValue = bibleStudiesRaw ? Number(bibleStudiesRaw) : 0;
    if (!Number.isFinite(bibleStudiesValue) || bibleStudiesValue < 0) {
      nextErrors.bibleStudies = "Bible studies must be 0 or greater.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      setFormErrorMessage("Please fix the highlighted form errors.");
      return;
    }

    const hasDuplicate = reports.some((report) => {
      if (editingReportId && report.id === editingReportId) return false;
      if (report.month !== selectedMonth || report.year !== selectedYear) return false;

      const samePersonById =
        String(report.personId || "").trim() === String(selected.id || "").trim();
      const samePersonByName =
        String(report.personName || "").trim().toLowerCase() ===
        String(selected.name || "").trim().toLowerCase();

      return samePersonById || samePersonByName;
    });

    if (hasDuplicate) {
      setFormErrorMessage(
        "A report for this person already exists for the selected month and year."
      );
      return;
    }

    setSaving(true);
    setSavingText(
      editingReportId ? "Updating field service report..." : "Saving field service report..."
    );
    try {
      const payload = {
        personId: selected.id,
        personName: selected.name,
        month: selectedMonth,
        year: selectedYear,
        regularPioneer: isRegularPioneer,
        auxiliaryPioneer: isAuxiliaryPioneer,
        hours: requiresHours ? hoursValue : null,
        bibleStudies: bibleStudiesValue,
        sharedMinistry: showSharedCheckbox ? form.sharedMinistry : computedSharedMinistry,
      };

      if (editingReportId) {
        await updateFieldServiceReport(editingReportId, payload);
      } else {
        await addFieldServiceReport(payload);
      }

      await reloadReports();
      closeCreateModal(true);
    } catch (err) {
      if (err?.code === "permission-denied") {
        setFormErrorMessage(
          "Missing Firestore permission for collection 'field_service_reports'. Update Firestore rules and try again."
        );
      } else {
        setFormErrorMessage(
          err?.message ||
            `Failed to ${editingReportId ? "update" : "create"} field service report.`
        );
      }
    } finally {
      setSaving(false);
      setSavingText("Saving field service report...");
    }
  }

  async function handleDeleteReport() {
    if (!reportToDelete?.id) return;

    setSaving(true);
    setSavingText("Deleting field service report...");
    try {
      await deleteFieldServiceReportById(reportToDelete.id);
      await reloadReports();
      closeDeleteModal(true);
    } catch (err) {
      if (err?.code === "permission-denied") {
        setError(
          "Missing Firestore permission for collection 'field_service_reports'. Update Firestore rules and try again."
        );
      } else {
        setError(err?.message || "Failed to delete field service report.");
      }
    } finally {
      setSaving(false);
      setSavingText("Saving field service report...");
    }
  }

  return (
    <>
      {(loading || saving) && (
        <FullscreenLoader
          text={saving ? savingText : "Loading field service reports..."}
        />
      )}

      <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
        <h4 className="mb-0">Field Service Reports</h4>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          Create Report
        </button>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="card p-3 mb-3">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-3">
            <label htmlFor="field-service-month" className="form-label mb-1">
              Month
            </label>
            <select
              id="field-service-month"
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

          <div className="col-12 col-md-3">
            <label htmlFor="field-service-year" className="form-label mb-1">
              Year
            </label>
            <select
              id="field-service-year"
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

          <div className="col-12 col-md-3">
            <label htmlFor="field-service-status" className="form-label mb-1">
              Status
            </label>
            <select
              id="field-service-status"
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="badge text-bg-primary fs-6">
          {selectedMonthLabel} {selectedYear}
        </span>
        <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
          <span className="badge text-bg-secondary fs-6">
            Total: {filteredReports.length}
          </span>
          <span className="badge text-bg-secondary fs-6">
            Total Hours: {totalHours}
          </span>
          <span className="badge text-bg-secondary fs-6">
            Total Bible Studies: {totalBibleStudies}
          </span>
        </div>
      </div>

      <div className="table-responsive list-items-scroll field-service-list-scroll">
        <table className="table table-striped table-hover align-middle">
          <thead className="table-dark">
            <tr>
              <th scope="col">Person Name</th>
              <th scope="col">Status</th>
              <th scope="col">Shared Ministry</th>
              <th scope="col">Number of Hours</th>
              <th scope="col">Bible Studies</th>
              <th scope="col" className="text-end">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-4 text-muted">
                  No field service reports found for {selectedMonthLabel} {selectedYear}.
                </td>
              </tr>
            ) : (
              filteredReports.map((report) => (
                <tr key={report.id}>
                  <td>{report.personName || "-"}</td>
                  <td>{reportStatusLabel(report)}</td>
                  <td>{booleanLabel(report.sharedMinistry)}</td>
                  <td>{report.hours ?? "-"}</td>
                  <td>{report.bibleStudies ?? "-"}</td>
                  <td className="text-end">
                    <Dropdown align="end">
                      <Dropdown.Toggle
                        as={KebabToggle}
                        id={`field-service-report-actions-${report.id}`}
                      />
                      <Dropdown.Menu>
                        <Dropdown.Item onClick={() => openEditModal(report)}>
                          Edit
                        </Dropdown.Item>
                        <Dropdown.Item
                          className="text-danger"
                          onClick={() => openDeleteModal(report)}
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
            {editingReportId ? "Edit Field Service Report" : "Create Field Service Report"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formErrorMessage && (
            <div className="alert alert-danger py-2">{formErrorMessage}</div>
          )}

          <div className="mb-3">
            <small className="text-muted d-block">Reporting Period</small>
            <strong>
              {selectedMonthLabel} {selectedYear}
            </strong>
          </div>

          <div className="mb-3">
            <label htmlFor="person-search" className="form-label mb-1">
              Person
            </label>
            <div className="position-relative">
              <input
                id="person-search"
                type="text"
                className={`form-control ${
                  formErrors.personId ? "is-invalid" : ""
                } ${selectedPerson ? "pe-5" : ""}`}
                placeholder="Type to search person..."
                value={personSearch}
                onChange={(e) => handlePersonSearchChange(e.target.value)}
              />
              {selectedPerson && (
                <button
                  type="button"
                  className="btn btn-link text-secondary p-0 position-absolute top-50 end-0 translate-middle-y me-3 text-decoration-none"
                  onClick={clearSelectedPerson}
                  aria-label="Clear selected person"
                  title="Clear"
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>
            {formErrors.personId && (
              <div className="invalid-feedback d-block">{formErrors.personId}</div>
            )}

            {!selectedPerson && (
              <div
                className="border rounded mt-2 overflow-auto"
                style={{ maxHeight: 180 }}
              >
                {filteredPersonOptions.length === 0 ? (
                  <div className="px-3 py-2 text-muted small">No matching person.</div>
                ) : (
                  filteredPersonOptions.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      className={`list-group-item list-group-item-action border-0 w-100 text-start ${
                        selectedPersonId === person.id ? "active" : ""
                      }`}
                      onClick={() => handlePersonSelect(person)}
                    >
                      {person.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {selectedPerson && (
            <>
              <div className="mb-3">
                <span className="badge text-bg-info">
                  Regular Pioneer: {isRegularPioneer ? "Yes" : "No"}
                </span>
              </div>

              {!isRegularPioneer && (
                <div className="form-check mb-2">
                  <input
                    id="auxiliaryPioneer"
                    className="form-check-input"
                    type="checkbox"
                    checked={form.auxiliaryPioneer}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      onFormChange("auxiliaryPioneer", checked);
                      if (checked) {
                        onFormChange("sharedMinistry", false);
                      } else {
                        onFormChange("hours", "");
                        onFormChange("sharedMinistry", true);
                      }
                    }}
                  />
                  <label htmlFor="auxiliaryPioneer" className="form-check-label">
                    Auxilliary Pioneer
                  </label>
                </div>
              )}

              {requiresHours && (
                <div className="mb-3">
                  <label htmlFor="report-hours" className="form-label mb-1">
                    Number of Hours
                  </label>
                  <input
                    id="report-hours"
                    type="number"
                    min="0"
                    step="0.1"
                    className={`form-control ${formErrors.hours ? "is-invalid" : ""}`}
                    value={form.hours}
                    onChange={(e) => onFormChange("hours", e.target.value)}
                  />
                  {formErrors.hours && (
                    <div className="invalid-feedback">{formErrors.hours}</div>
                  )}
                  <small className="text-muted">
                    Shared Ministry is automatic for pioneer reports with hours.
                  </small>
                </div>
              )}

              {showSharedCheckbox && (
                <div className="form-check mb-3">
                  <input
                    id="sharedMinistry"
                    className="form-check-input"
                    type="checkbox"
                    checked={form.sharedMinistry}
                    onChange={(e) => onFormChange("sharedMinistry", e.target.checked)}
                  />
                  <label htmlFor="sharedMinistry" className="form-check-label">
                    Shared Ministry
                  </label>
                </div>
              )}

              <div className="mb-3">
                <label htmlFor="bibleStudies" className="form-label mb-1">
                  Number of Bible Studies
                </label>
                <input
                  id="bibleStudies"
                  type="number"
                  min="0"
                  step="1"
                  className={`form-control ${
                    formErrors.bibleStudies ? "is-invalid" : ""
                  }`}
                  value={form.bibleStudies}
                  onChange={(e) => onFormChange("bibleStudies", e.target.value)}
                />
                {formErrors.bibleStudies && (
                  <div className="invalid-feedback">{formErrors.bibleStudies}</div>
                )}
              </div>
            </>
          )}
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
            onClick={handleSaveReport}
            disabled={saving}
          >
            {editingReportId ? "Update Report" : "Save Report"}
          </button>
        </Modal.Footer>
      </Modal>

      <Modal show={showDeleteModal} onHide={closeDeleteModal} centered>
        <Modal.Header closeButton={!saving}>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Delete report for{" "}
          <strong>{reportToDelete?.personName || "this person"}</strong>?
          This action cannot be undone.
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
            onClick={handleDeleteReport}
            disabled={saving}
          >
            Delete
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
