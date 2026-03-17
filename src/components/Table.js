import { forwardRef, useMemo, useState } from "react";
import { Dropdown } from "react-bootstrap";
import { ROLES } from "../shared/constants";
import { updatePerson } from "../shared/services/persons.firestore";

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

export default function Table({ persons = [], onEdit, onDelete, onUpdate }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [savingId, setSavingId] = useState(null);

  const ROLE_LIST = Object.values(ROLES);

  /* =========================
     NORMALIZATION (READ-ONLY)
  ========================= */
  const normalizedPersons = useMemo(() => {
    return persons
      .map((p) => ({
        id: p.id,
        name: p.name ?? "",
        roles: Array.isArray(p.roles) ? [...p.roles] : [],
      }))
      .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      .filter((p) => (roleFilter ? p.roles.includes(roleFilter) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [persons, search, roleFilter]);

  /* =========================
     ROLE TOGGLE (WRITE-THROUGH)
  ========================= */
  async function toggleRole(personId, role) {
    const person = persons.find((p) => p.id === personId);
    if (!person) return;

    const roles = Array.isArray(person.roles) ? [...person.roles] : [];

    // Female users cannot be tagged as Student Pahayag.
    if (role === ROLES.STUDENT_PAHAYAG && roles.includes(ROLES.FEMALE)) {
      return;
    }

    const exists = roles.includes(role);
    let nextRoles = exists
      ? roles.filter((r) => r !== role)
      : [...roles, role];

    // Turning on Female also removes Student Pahayag from the same person.
    if (role === ROLES.FEMALE && !exists) {
      nextRoles = nextRoles.filter((r) => r !== ROLES.STUDENT_PAHAYAG);
    }

    const updatedPerson = {
      ...person,
      roles: nextRoles,
    };

    try {
      setSavingId(personId);

      // Persist to Firestore
      await updatePerson(personId, updatedPerson);

      // Replace only the updated row
      onUpdate((prev) =>
        prev.map((p) => (p.id === personId ? updatedPerson : p))
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      {/* Search + Filter */}
      <div className="d-flex gap-2 mb-2">
        <input
          type="text"
          className="form-control"
          placeholder="Search name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="form-select w-auto"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All Roles</option>
          {ROLE_LIST.map((role) => (
            <option key={role} value={role}>
              {role.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="table-responsive list-items-scroll">
        <table className="table table-bordered table-striped align-middle mb-0">
          <thead className="table-dark">
            <tr>
              <th>Name</th>
              {ROLE_LIST.map((role) => (
                <th key={role} className="text-center">
                  {role.replace("_", " ")}
                </th>
              ))}
              <th className="text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {normalizedPersons.length === 0 && (
              <tr>
                <td
                  colSpan={ROLE_LIST.length + 2}
                  className="text-center text-muted"
                >
                  No records found
                </td>
              </tr>
            )}

            {normalizedPersons.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>

                {ROLE_LIST.map((role) => (
                  <td key={role} className="text-center">
                    {role === ROLES.STUDENT_PAHAYAG &&
                    p.roles.includes(ROLES.FEMALE) ? (
                      <span className="text-muted" title="Not available for female">
                        -
                      </span>
                    ) : (
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={p.roles.includes(role)}
                        disabled={savingId === p.id}
                        onChange={() => toggleRole(p.id, role)}
                      />
                    )}
                  </td>
                ))}

                <td className="text-center">
                  <Dropdown align="end">
                    <Dropdown.Toggle as={KebabToggle} id={`row-actions-${p.id}`} />
                    <Dropdown.Menu>
                      <Dropdown.Item onClick={() => onEdit(p)}>
                        Edit
                      </Dropdown.Item>
                      <Dropdown.Item
                        className="text-danger"
                        onClick={() => onDelete(p.id)}
                      >
                        Delete
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
