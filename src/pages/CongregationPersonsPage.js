import { forwardRef, useEffect, useMemo, useState } from "react";
import { Dropdown, Modal } from "react-bootstrap";
import FullscreenLoader from "../components/FullscreenLoader";
import {
  addCongregationPerson,
  deleteCongregationPersonById,
  fetchCongregationPersons,
  updateCongregationPerson,
} from "../shared/services/congregation-persons.firestore";
import clearFilterIcon from "../assets/icons/clear-filter.png";

function toTitleCase(value = "") {
  if (!value) return "-";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function statusClass(status) {
  if (status === "inactive") return "text-bg-warning";
  if (status === "removed") return "text-bg-danger";
  return "text-bg-success";
}

function toProperCase(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\b([a-z])/g, (ch) => ch.toUpperCase());
}

function formatLongDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

const INITIAL_FORM = {
  firstName: "",
  middleName: "",
  lastName: "",
  status: "",
  removalDate: "",
  privilege: "",
  regularPioneer: false,
  gender: "",
  contactNumber: "",
  birthday: "",
  baptismalDate: "",
};

const REQUIRED_FIELDS = [
  "firstName",
  "lastName",
  "status",
  "gender",
  "birthday",
];
const STATUS_FILTER_OPTIONS = ["active", "inactive", "removed"];

function sanitizeNameInput(value) {
  return value.replace(/[^A-Za-z\s]/g, "");
}

function sanitizeContactNumber(value) {
  return value.replace(/\D/g, "");
}

function parseNameParts(name = "") {
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "", middleName: "", lastName: "" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], middleName: "", lastName: "" };
  }

  if (parts.length === 2) {
    return { firstName: parts[0], middleName: "", lastName: parts[1] };
  }

  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function toFormValues(person) {
  const parsed = parseNameParts(person?.name);

  return {
    firstName: person?.firstName ?? parsed.firstName,
    middleName: person?.middleName ?? parsed.middleName,
    lastName: person?.lastName ?? parsed.lastName,
    status: person?.status ?? "",
    removalDate: person?.removalDate ?? "",
    privilege: person?.privilege ?? "",
    regularPioneer: Boolean(person?.regularPioneer),
    gender: person?.gender ?? "",
    contactNumber: person?.contactNumber ?? "",
    birthday: person?.birthday ?? "",
    baptismalDate: person?.baptismalDate ?? "",
  };
}

function formatDisplayName(person) {
  const parsed = parseNameParts(person?.name);

  const firstName = toProperCase(person?.firstName ?? parsed.firstName);
  const middleName = toProperCase(person?.middleName ?? parsed.middleName);
  const lastName = toProperCase(person?.lastName ?? parsed.lastName);

  if (lastName && (firstName || middleName)) {
    return `${lastName}, ${[firstName, middleName].filter(Boolean).join(" ")}`;
  }

  if (lastName) return lastName;

  const combined = [firstName, middleName].filter(Boolean).join(" ");
  if (combined) return combined;

  return toProperCase(person?.name || "");
}

function formatStatusText(person) {
  const status = toTitleCase(person?.status || "");
  if (person?.status === "removed" && person?.removalDate) {
    return `${status} (${formatLongDate(person.removalDate)})`;
  }
  return status || "-";
}

const KebabToggle = forwardRef(function KebabToggle({ onClick }, ref) {
  return (
    <button
      type="button"
      className="btn btn-link text-dark p-0 border-0 shadow-none"
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick(e);
      }}
      aria-label="Row actions"
      title="Actions"
    >
      <i className="fas fa-ellipsis-v"></i>
    </button>
  );
});

export default function CongregationPersonsPage() {
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState([]);
  const [privilegeFilter, setPrivilegeFilter] = useState("all");
  const [pioneerFilter, setPioneerFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formErrorMessage, setFormErrorMessage] = useState("");
  const [editingPersonId, setEditingPersonId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [personToDelete, setPersonToDelete] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [personToView, setPersonToView] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadPersons() {
      setLoading(true);
      setError("");

      try {
        const data = await fetchCongregationPersons();
        if (mounted) setPersons(data);
      } catch (err) {
        if (mounted) {
          if (err?.code === "permission-denied") {
            setError(
              "Missing Firestore permission for collection 'congregation_persons'. Update Firestore rules and try again.",
            );
          } else {
            setError(err?.message || "Failed to fetch congregation persons.");
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPersons();

    return () => {
      mounted = false;
    };
  }, []);

  const privilegeOptions = useMemo(() => {
    return [...new Set(persons.map((p) => p.privilege).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b),
    );
  }, [persons]);

  const genderOptions = useMemo(() => {
    return [...new Set(persons.map((p) => p.gender).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b),
    );
  }, [persons]);

  const statusFilterLabel = useMemo(() => {
    if (statusFilter.length === 0) return "All Status";
    if (statusFilter.length === 1) return toTitleCase(statusFilter[0]);
    return `${statusFilter.length} selected`;
  }, [statusFilter]);

  const filteredPersons = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return persons
      .filter((person) => {
        if (
          normalizedSearch &&
          !person.name.toLowerCase().includes(normalizedSearch)
        ) {
          return false;
        }

        if (statusFilter.length > 0 && !statusFilter.includes(person.status)) {
          return false;
        }

        if (
          privilegeFilter !== "all" &&
          person.privilege !== privilegeFilter
        ) {
          return false;
        }

        if (
          pioneerFilter !== "all" &&
          String(person.regularPioneer) !== pioneerFilter
        ) {
          return false;
        }

        if (genderFilter !== "all" && person.gender !== genderFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) =>
        formatDisplayName(a).localeCompare(formatDisplayName(b), undefined, {
          sensitivity: "base",
        })
      );
  }, [
    persons,
    search,
    statusFilter,
    privilegeFilter,
    pioneerFilter,
    genderFilter,
  ]);

  const totalVisible = filteredPersons.length;
  const totalAll = persons.length;

  function clearFilters() {
    setSearch("");
    setStatusFilter([]);
    setPrivilegeFilter("all");
    setPioneerFilter("all");
    setGenderFilter("all");
  }

  function toggleStatusFilter(status) {
    setStatusFilter((prev) =>
      prev.includes(status)
        ? prev.filter((current) => current !== status)
        : [...prev, status]
    );
  }

  function openAddModal() {
    setEditingPersonId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    setFormErrorMessage("");
    setShowAddModal(true);
  }

  function openEditModal(person) {
    setEditingPersonId(person.id);
    setForm(toFormValues(person));
    setFormErrors({});
    setFormErrorMessage("");
    setShowAddModal(true);
  }

  function closeAddModal() {
    if (saving) return;
    setShowAddModal(false);
    setEditingPersonId(null);
  }

  function openDeleteModal(person) {
    setPersonToDelete(person);
    setShowDeleteModal(true);
  }

  function closeDeleteModal() {
    if (saving) return;
    setShowDeleteModal(false);
    setPersonToDelete(null);
  }

  function openViewModal(person) {
    setPersonToView(person);
    setShowViewModal(true);
  }

  function closeViewModal() {
    setShowViewModal(false);
    setPersonToView(null);
  }

  function handleEditFromView() {
    if (!personToView) return;
    closeViewModal();
    openEditModal(personToView);
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

  function validateForm(current) {
    const nextErrors = {};

    for (const field of REQUIRED_FIELDS) {
      if (!String(current[field] ?? "").trim()) {
        nextErrors[field] = "This field is required.";
      }
    }

    const contactNumber = String(current.contactNumber || "").trim();
    if (contactNumber && contactNumber.length !== 11) {
      nextErrors.contactNumber = "Contact No. must be exactly 11 digits.";
    }

    if (current.status === "removed" && !String(current.removalDate || "").trim()) {
      nextErrors.removalDate = "Date of removal is required for removed status.";
    }

    return nextErrors;
  }

  async function handleSavePerson() {
    setFormErrorMessage("");

    const normalizedForm = {
      ...form,
      firstName: toProperCase(form.firstName),
      middleName: toProperCase(form.middleName),
      lastName: toProperCase(form.lastName),
      privilege: toProperCase(form.privilege),
      gender: toProperCase(form.gender),
    };

    setForm(normalizedForm);

    const validationErrors = validateForm(normalizedForm);
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      setFormErrorMessage("Please fix the highlighted form errors.");
      return;
    }

    setSaving(true);
    try {
      if (editingPersonId) {
        await updateCongregationPerson(editingPersonId, normalizedForm);
      } else {
        await addCongregationPerson(normalizedForm);
      }

      const data = await fetchCongregationPersons();
      setPersons(data);
      setShowAddModal(false);
      setEditingPersonId(null);
      setForm(INITIAL_FORM);
      setFormErrors({});
      setFormErrorMessage("");
    } catch (err) {
      if (err?.code === "permission-denied") {
        setFormErrorMessage(
          "Missing Firestore permission for collection 'congregation_persons'. Update Firestore rules and try again."
        );
      } else {
        setFormErrorMessage(
          err?.message ||
            `Failed to ${editingPersonId ? "update" : "add"} person.`
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePerson() {
    if (!personToDelete?.id) return;

    setSaving(true);
    try {
      await deleteCongregationPersonById(personToDelete.id);
      const data = await fetchCongregationPersons();
      setPersons(data);
      closeDeleteModal();
    } catch (err) {
      if (err?.code === "permission-denied") {
        setError(
          "Missing Firestore permission for collection 'congregation_persons'. Update Firestore rules and try again."
        );
      } else {
        setError(err?.message || "Failed to delete person.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {(loading || saving) && (
        <FullscreenLoader
          text={saving ? "Saving person..." : "Loading congregation persons..."}
        />
      )}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Congregation Persons</h4>
        <button type="button" className="btn btn-primary" onClick={openAddModal}>
          Add Person
        </button>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="card p-3 mb-3">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-lg-3">
            <input
              type="text"
              className="form-control"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="col-6 col-lg-2">
            <Dropdown autoClose="outside">
              <Dropdown.Toggle
                variant="light"
                className="w-100 d-flex justify-content-between align-items-center border"
              >
                {statusFilterLabel}
              </Dropdown.Toggle>
              <Dropdown.Menu className="w-100 p-2">
                {STATUS_FILTER_OPTIONS.map((value) => {
                  const inputId = `status-filter-${value}`;
                  return (
                    <div key={value} className="form-check mb-1">
                      <input
                        id={inputId}
                        type="checkbox"
                        className="form-check-input"
                        checked={statusFilter.includes(value)}
                        onChange={() => toggleStatusFilter(value)}
                      />
                      <label className="form-check-label" htmlFor={inputId}>
                        {toTitleCase(value)}
                      </label>
                    </div>
                  );
                })}
              </Dropdown.Menu>
            </Dropdown>
          </div>

          <div className="col-6 col-lg-2">
            <select
              className="form-select"
              value={privilegeFilter}
              onChange={(e) => setPrivilegeFilter(e.target.value)}
            >
              <option value="all">All Privilege</option>
              {privilegeOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-lg-2">
            <select
              className="form-select"
              value={pioneerFilter}
              onChange={(e) => setPioneerFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="true">Regular Pioner</option>
              <option value="false">Publisher</option>
            </select>
          </div>

          <div className="col-6 col-lg-2">
            <select
              className="form-select"
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
            >
              <option value="all">All Gender</option>
              {genderOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-lg-auto d-flex justify-content-lg-end">
            <button
              type="button"
              className="btn btn-outline-secondary d-inline-flex align-items-center justify-content-center"
              onClick={clearFilters}
              aria-label="Clear filters"
              title="Clear filters"
            >
              <img
                src={clearFilterIcon}
                alt=""
                aria-hidden="true"
                style={{ width: 18, height: 18, objectFit: "contain" }}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="d-flex justify-content-end mb-2">
        <span className="badge text-bg-secondary fs-6">
          Total: {totalVisible}
          {totalVisible !== totalAll ? ` / ${totalAll}` : ""}
        </span>
      </div>

      <div className="table-responsive list-items-scroll congregation-list-scroll">
        <table className="table table-striped table-hover align-middle">
          <thead className="table-dark">
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Status</th>
              <th scope="col">Age</th>
              <th scope="col">Contact No.</th>
              <th scope="col">Privilege</th>
              <th scope="col">RP</th>
              <th scope="col">Gender</th>
              <th scope="col" className="text-end">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {persons.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-4 text-muted">
                  No congregation persons found.
                </td>
              </tr>
            ) : filteredPersons.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-4 text-muted">
                  No matches for current search/filter.
                </td>
              </tr>
            ) : (
              filteredPersons.map((person) => (
                <tr
                  key={person.id}
                  onClick={() => openViewModal(person)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{formatDisplayName(person) || "-"}</td>
                  <td>
                    <span className={`badge ${statusClass(person.status)}`}>
                      {toTitleCase(person.status)}
                    </span>
                    {person.status === "removed" && person.removalDate && (
                      <div className="small text-muted mt-1">
                        {formatLongDate(person.removalDate)}
                      </div>
                    )}
                  </td>
                  <td>{person.age ?? "-"}</td>
                  <td>{person.contactNumber || "-"}</td>
                  <td>{toProperCase(person.privilege) || "-"}</td>
                  <td>{person.regularPioneer ? "Yes" : "No"}</td>
                  <td>{toProperCase(person.gender) || "-"}</td>
                  <td className="text-end" onClick={(e) => e.stopPropagation()}>
                    <Dropdown align="end">
                      <Dropdown.Toggle
                        as={KebabToggle}
                        id={`row-actions-${person.id}`}
                      />
                      <Dropdown.Menu>
                        <Dropdown.Item
                          onClick={(e) => {
                            e.stopPropagation();
                            openViewModal(person);
                          }}
                        >
                          View
                        </Dropdown.Item>
                        <Dropdown.Item
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(person);
                          }}
                        >
                          Edit
                        </Dropdown.Item>
                        <Dropdown.Item
                          className="text-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteModal(person);
                          }}
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

      <Modal show={showAddModal} onHide={closeAddModal} centered>
        <Modal.Header closeButton={!saving}>
          <Modal.Title>{editingPersonId ? "Edit Person" : "Add Person"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formErrorMessage && (
            <div className="alert alert-danger py-2">{formErrorMessage}</div>
          )}

          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label mb-1">
                First Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className={`form-control ${
                  formErrors.firstName ? "is-invalid" : ""
                }`}
                value={form.firstName}
                onChange={(e) =>
                  onFormChange("firstName", sanitizeNameInput(e.target.value))
                }
              />
              {formErrors.firstName && (
                <div className="invalid-feedback">{formErrors.firstName}</div>
              )}
            </div>

            <div className="col-md-4">
              <label className="form-label mb-1">Middle Name</label>
              <input
                type="text"
                className="form-control"
                value={form.middleName}
                onChange={(e) =>
                  onFormChange("middleName", sanitizeNameInput(e.target.value))
                }
              />
            </div>

            <div className="col-md-4">
              <label className="form-label mb-1">
                Last Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className={`form-control ${
                  formErrors.lastName ? "is-invalid" : ""
                }`}
                value={form.lastName}
                onChange={(e) =>
                  onFormChange("lastName", sanitizeNameInput(e.target.value))
                }
              />
              {formErrors.lastName && (
                <div className="invalid-feedback">{formErrors.lastName}</div>
              )}
            </div>

            <div className="col-md-6">
              <label className="form-label mb-1">
                Status <span className="text-danger">*</span>
              </label>
              <select
                className={`form-select ${formErrors.status ? "is-invalid" : ""}`}
                value={form.status}
                onChange={(e) => {
                  const nextStatus = e.target.value;
                  onFormChange("status", nextStatus);
                  if (nextStatus !== "removed") {
                    onFormChange("removalDate", "");
                  }
                }}
              >
                <option value="">Select status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="removed">Removed</option>
              </select>
              {formErrors.status && (
                <div className="invalid-feedback">{formErrors.status}</div>
              )}
            </div>

            {form.status === "removed" && (
              <div className="col-md-6">
                <label className="form-label mb-1">
                  Date of Removal <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  className={`form-control ${
                    formErrors.removalDate ? "is-invalid" : ""
                  }`}
                  value={form.removalDate}
                  onChange={(e) => onFormChange("removalDate", e.target.value)}
                />
                {formErrors.removalDate && (
                  <div className="invalid-feedback">
                    {formErrors.removalDate}
                  </div>
                )}
              </div>
            )}

            <div className="col-md-6">
              <label className="form-label mb-1">Privilege</label>
              <select
                className="form-select"
                value={form.privilege}
                onChange={(e) => onFormChange("privilege", e.target.value)}
              >
                <option value="">Select privilege</option>
                <option value="elder">Elder</option>
                <option value="ministerial servant">Ministerial Servant</option>
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label mb-1">
                Gender <span className="text-danger">*</span>
              </label>
              <select
                className={`form-select ${formErrors.gender ? "is-invalid" : ""}`}
                value={form.gender}
                onChange={(e) => onFormChange("gender", e.target.value)}
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              {formErrors.gender && (
                <div className="invalid-feedback">{formErrors.gender}</div>
              )}
            </div>

            <div className="col-md-6 d-flex align-items-end">
              <div className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="regularPioneer"
                  checked={form.regularPioneer}
                  onChange={(e) =>
                    onFormChange("regularPioneer", e.target.checked)
                  }
                />
                <label className="form-check-label" htmlFor="regularPioneer">
                  Regular Pioneer
                </label>
              </div>
            </div>

            <div className="col-md-6">
              <label className="form-label mb-1">
                Contact No.
              </label>
              <input
                type="tel"
                className={`form-control ${
                  formErrors.contactNumber ? "is-invalid" : ""
                }`}
                maxLength={11}
                value={form.contactNumber}
                onChange={(e) =>
                  onFormChange(
                    "contactNumber",
                    sanitizeContactNumber(e.target.value)
                  )
                }
              />
              {formErrors.contactNumber && (
                <div className="invalid-feedback">
                  {formErrors.contactNumber}
                </div>
              )}
            </div>

            <div className="col-md-6">
              <label className="form-label mb-1">
                Birthday <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                className={`form-control ${
                  formErrors.birthday ? "is-invalid" : ""
                }`}
                value={form.birthday}
                onChange={(e) => onFormChange("birthday", e.target.value)}
              />
              {formErrors.birthday && (
                <div className="invalid-feedback">{formErrors.birthday}</div>
              )}
            </div>

            <div className="col-md-6">
              <label className="form-label mb-1">Baptismal Date</label>
              <input
                type="date"
                className={`form-control ${
                  formErrors.baptismalDate ? "is-invalid" : ""
                }`}
                value={form.baptismalDate}
                onChange={(e) => onFormChange("baptismalDate", e.target.value)}
              />
              {formErrors.baptismalDate && (
                <div className="invalid-feedback">
                  {formErrors.baptismalDate}
                </div>
              )}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={closeAddModal}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSavePerson}
            disabled={saving}
          >
            {editingPersonId ? "Update" : "Save"}
          </button>
        </Modal.Footer>
      </Modal>

      <Modal show={showViewModal} onHide={closeViewModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Person Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="row g-2">
            <div className="col-6">
              <small className="text-muted d-block">First Name</small>
              <div>{toProperCase(personToView?.firstName) || "-"}</div>
            </div>
            <div className="col-6">
              <small className="text-muted d-block">Middle Name</small>
              <div>{toProperCase(personToView?.middleName) || "-"}</div>
            </div>
            <div className="col-6">
              <small className="text-muted d-block">Last Name</small>
              <div>{toProperCase(personToView?.lastName) || "-"}</div>
            </div>
            <div className="col-6">
              <small className="text-muted d-block">Name</small>
              <div>{formatDisplayName(personToView) || "-"}</div>
            </div>
            <div className="col-6">
              <small className="text-muted d-block">Status</small>
              <div>{formatStatusText(personToView)}</div>
            </div>
            <div className="col-6">
              <small className="text-muted d-block">Age</small>
              <div>{personToView?.age ?? "-"}</div>
            </div>
            <div className="col-6">
              <small className="text-muted d-block">Privilege</small>
              <div>{toProperCase(personToView?.privilege) || "-"}</div>
            </div>
            <div className="col-6">
              <small className="text-muted d-block">Regular Pioneer</small>
              <div>{personToView?.regularPioneer ? "Yes" : "No"}</div>
            </div>
            <div className="col-6">
              <small className="text-muted d-block">Gender</small>
              <div>{toProperCase(personToView?.gender) || "-"}</div>
            </div>
            <div className="col-6">
              <small className="text-muted d-block">Contact No.</small>
              <div>{personToView?.contactNumber || "-"}</div>
            </div>
            <div className="col-6">
              <small className="text-muted d-block">Birthday</small>
              <div>{formatLongDate(personToView?.birthday)}</div>
            </div>
            <div className="col-6">
              <small className="text-muted d-block">Baptismal Date</small>
              <div>{formatLongDate(personToView?.baptismalDate)}</div>
            </div>
            {personToView?.status === "removed" && (
              <div className="col-6">
                <small className="text-muted d-block">Date of Removal</small>
                <div>{formatLongDate(personToView?.removalDate)}</div>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleEditFromView}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={closeViewModal}
          >
            Close
          </button>
        </Modal.Footer>
      </Modal>

      <Modal show={showDeleteModal} onHide={closeDeleteModal} centered>
        <Modal.Header closeButton={!saving}>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Delete{" "}
          <strong>{formatDisplayName(personToDelete) || "this person"}</strong>
          ? This action cannot be undone.
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
            onClick={handleDeletePerson}
            disabled={saving}
          >
            Delete
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
