const OPTIONS = ["Elder", "MS", "Student", "Bible Reader"];

export default function Table({ persons = [], onEdit, onDelete, onUpdate }) {
  // Normalize dataset once per render
  const normalizedPersons = persons.map((p) => ({
    id: p.id,
    name: p.name ?? "",
    assignments: Array.isArray(p.assignments) ? p.assignments : [],
  }));

  function toggleAssignment(personId, value) {
    const updated = normalizedPersons.map((p) => {
      if (p.id !== personId) return p;

      const exists = p.assignments.includes(value);

      return {
        ...p,
        assignments: exists
          ? p.assignments.filter((a) => a !== value)
          : [...p.assignments, value],
      };
    });

    onUpdate(updated);
  }

  return (
    <div className="table-responsive">
      <table className="table table-bordered table-striped align-middle">
        <thead className="table-light">
          <tr>
            <th>Name</th>
            {OPTIONS.map((o) => (
              <th key={o} className="text-center">
                {o}
              </th>
            ))}
            <th className="text-center">Actions</th>
          </tr>
        </thead>

        <tbody>
          {normalizedPersons.length === 0 && (
            <tr>
              <td
                colSpan={OPTIONS.length + 2}
                className="text-center text-muted"
              >
                No records found
              </td>
            </tr>
          )}

          {normalizedPersons.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>

              {OPTIONS.map((o) => (
                <td key={o} className="text-center">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={p.assignments.includes(o)}
                    onChange={() => toggleAssignment(p.id, o)}
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
