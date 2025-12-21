import { useMemo, useState } from "react";
import { ROLES } from "../shared/constants";
import { updatePerson } from "../shared/services/persons.firestore";

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
        roles: Array.isArray(p.roles) ? [...p.roles] : [], // CLONE
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

    // 🔒 ALWAYS CLONE
    const roles = Array.isArray(person.roles) ? [...person.roles] : [];
    const exists = roles.includes(role);

    const updatedPerson = {
      ...person,
      roles: exists ? roles.filter((r) => r !== role) : [...roles, role],
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
    <div className="table-responsive">
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

      <table className="table table-bordered table-striped align-middle">
        <thead className="table-light">
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
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={p.roles.includes(role)}
                    disabled={savingId === p.id}
                    onChange={() => toggleRole(p.id, role)}
                  />
                </td>
              ))}

              <td className="text-center">
                <button
                  className="btn btn-sm btn-outline-primary me-2"
                  onClick={() => onEdit(p)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => onDelete(p.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
