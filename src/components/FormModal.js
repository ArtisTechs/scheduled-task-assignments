import { useState } from "react";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function FormModal({ person, onSave, onClose, error }) {
  const [name, setName] = useState(person.name || "");

  function submit() {
    onSave({
      id: person.id || generateId(),
      name: name.trim(),
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
