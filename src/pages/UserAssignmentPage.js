import { useEffect, useState } from "react";
import Table from "../components/Table";
import FormModal from "../components/FormModal";
import FullscreenLoader from "../components/FullscreenLoader";

import {
  fetchPersons,
  addPerson as addPersonFS,
  updatePerson as updatePersonFS,
  deletePersonById,
} from "../shared/services/persons.firestore";

import { STORAGE_KEYS } from "../shared/keys/storage.keys";

export default function UserAssignmentPage({ persons, onUpdate }) {
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /* ===== RELOAD FROM FIRESTORE (REPLACE ONLY) ===== */
  async function reloadPersons() {
    setLoading(true);

    const data = await fetchPersons();

    // replace state
    onUpdate(data);

    // replace local cache
    localStorage.setItem(STORAGE_KEYS.PERSONS, JSON.stringify(data));

    setLoading(false);
  }

  /* ===== INITIAL LOAD (FROM CACHE OR FIRESTORE) ===== */
  useEffect(() => {
    if (persons.length) return;

    const cached = localStorage.getItem(STORAGE_KEYS.PERSONS);
    if (cached) {
      try {
        onUpdate(JSON.parse(cached));
        return;
      } catch {
        localStorage.removeItem(STORAGE_KEYS.PERSONS);
      }
    }

    reloadPersons();
  }, []);

  function isDuplicateName(name, ignoreId = null) {
    const normalized = name.trim().toLowerCase();
    return persons.some(
      (p) => p.name.trim().toLowerCase() === normalized && p.id !== ignoreId
    );
  }

  /* ===== CREATE ===== */
  async function addPerson(person) {
    if (isDuplicateName(person.name)) {
      setError("Name already exists.");
      return;
    }

    setLoading(true);
    await addPersonFS(person);
    await reloadPersons();
    setError("");
  }

  /* ===== UPDATE ===== */
  async function editPerson(updatedPerson) {
    if (isDuplicateName(updatedPerson.name, updatedPerson.id)) {
      setError("Name already exists.");
      return;
    }

    setLoading(true);
    await updatePersonFS(updatedPerson.id, updatedPerson);
    await reloadPersons();
    setEditing(null);
    setError("");
  }

  /* ===== DELETE ===== */
  async function deletePerson(id) {
    setLoading(true);
    await deletePersonById(id);
    await reloadPersons();
  }

  return (
    <>
      {loading && <FullscreenLoader text="Updating persons…" />}

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
