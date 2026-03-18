import { useState } from "react";
import { ROLES } from "../shared/constants";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function FormModal({ person, onSave, onClose, error }) {
  const [name, setName] = useState(person.name || "");
  const [roles, setRoles] = useState(Array.isArray(person.roles) ? person.roles : []);

  const ROLE_LIST = Object.values(ROLES);

  function toggleRole(role) {
    setRoles((current) => {
      const exists = current.includes(role);
      let next = exists
        ? current.filter((r) => r !== role)
        : [...current, role];

      // Keep behavior aligned with User Assignment table restrictions.
      if (role === ROLES.FEMALE && !exists) {
        next = next.filter((r) => r !== ROLES.STUDENT_PAHAYAG);
      }

      if (role === ROLES.STUDENT_PAHAYAG && !exists) {
        next = next.filter((r) => r !== ROLES.FEMALE);
      }

      return next;
    });
  }

  function submit() {
    onSave({
      id: person.id || generateId(),
      name: name.trim(),
      roles,
      assignments: person.assignments || [],
    });
  }

  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-dialog-centered" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                {person.id ? "Edit Person" : "Add Person"}
              </h5>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>

            <div className="modal-body">
              {error && <div className="alert alert-danger py-2">{error}</div>}

              <input
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                autoFocus
              />

              <div className="mt-3">
                <label className="form-label mb-2 fw-semibold">Assignment Roles</label>
                <div className="row g-2">
                  {ROLE_LIST.map((role) => {
                    const isStudentPahayag = role === ROLES.STUDENT_PAHAYAG;
                    const femaleSelected = roles.includes(ROLES.FEMALE);
                    const disabled = isStudentPahayag && femaleSelected;

                    return (
                      <div key={role} className="col-6">
                        <div className="form-check">
                          <input
                            id={`role-${role}`}
                            className="form-check-input"
                            type="checkbox"
                            checked={roles.includes(role)}
                            disabled={disabled}
                            onChange={() => toggleRole(role)}
                          />
                          <label className="form-check-label" htmlFor={`role-${role}`}>
                            {role}
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={submit}
                disabled={!name.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="modal-backdrop fade show"></div>
    </>
  );
}
