import { useEffect, useState } from "react";
import Menu from "../components/SideMenu";
import Table from "../components/Table";
import FormModal from "../components/FormModal";
import { loadPersons, savePersons } from "../shared/services/storage.service";

export default function UserAssignmentPage() {
  const [persons, setPersons] = useState([]);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    setPersons(loadPersons());
  }, []);

  function updatePersons(updated) {
    setPersons(updated);
    savePersons(updated);
  }

  function addPerson(person) {
    updatePersons([...persons, person]);
  }

  function editPerson(updatedPerson) {
    updatePersons(
      persons.map((p) => (p.id === updatedPerson.id ? updatedPerson : p))
    );
    setEditing(null);
  }

  function deletePerson(id) {
    updatePersons(persons.filter((p) => p.id !== id));
  }

  return (
    <>
      <div className="d-flex justify-content-between mb-3">
        <h4>User Assignment</h4>
        <button className="btn btn-primary" onClick={() => setEditing({})}>
          Add Person
        </button>
      </div>

      <Table
        persons={persons}
        onEdit={setEditing}
        onDelete={deletePerson}
        onUpdate={updatePersons}
      />

      {editing !== null && (
        <FormModal
          person={editing}
          onSave={editing.id ? editPerson : addPerson}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
