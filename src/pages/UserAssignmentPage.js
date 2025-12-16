import { useState } from "react";
import Table from "../components/Table";
import FormModal from "../components/FormModal";

export default function UserAssignmentPage({ persons, onUpdate }) {
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  function isDuplicateName(name, ignoreId = null) {
    const normalized = name.trim().toLowerCase();
    return persons.some(
      (p) => p.name.trim().toLowerCase() === normalized && p.id !== ignoreId
    );
  }

  function addPerson(person) {
    if (isDuplicateName(person.name)) {
      setError("Name already exists.");
      return;
    }
    onUpdate([...persons, person]);
    setError("");
  }

  function editPerson(updatedPerson) {
    if (isDuplicateName(updatedPerson.name, updatedPerson.id)) {
      setError("Name already exists.");
      return;
    }
    onUpdate(
      persons.map((p) => (p.id === updatedPerson.id ? updatedPerson : p))
    );
    setEditing(null);
    setError("");
  }

  function deletePerson(id) {
    onUpdate(persons.filter((p) => p.id !== id));
  }

  return (
    <>
      <div className="d-flex justify-content-between mb-3">
        <h4>User Assignment</h4>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditing({});
            setError("");
          }}
        >
          Add Person
        </button>
      </div>

      <Table
        persons={persons}
        onEdit={(p) => {
          setEditing(p);
          setError("");
        }}
        onDelete={deletePerson}
        onUpdate={onUpdate}
      />

      {editing !== null && (
        <FormModal
          person={editing}
          error={error}
          onSave={editing.id ? editPerson : addPerson}
          onClose={() => {
            setEditing(null);
            setError("");
          }}
        />
      )}
    </>
  );
}
