import { useMemo, useState } from "react";
import { ROLES } from "../shared/constants";

export default function Table({ persons = [], onEdit, onDelete, onUpdate }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const ROLE_LIST = Object.values(ROLES);

  const normalizedPersons = useMemo(() => {
    return persons
      .map((p) => ({
        id: p.id,
        name: p.name ?? "",
        roles: Array.isArray(p.roles) ? p.roles : [],
      }))
      .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      .filter((p) => (roleFilter ? p.roles.includes(roleFilter) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [persons, search, roleFilter]);

  function toggleRole(personId, role) {
    const updated = persons.map((p) => {
      if (p.id !== personId) return p;

      const roles = Array.isArray(p.roles) ? p.roles : [];
      const exists = roles.includes(role);

      return {
        ...p,
        roles: exists ? roles.filter((r) => r !== role) : [...roles, role],
      };
    });

    onUpdate(updated);
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
