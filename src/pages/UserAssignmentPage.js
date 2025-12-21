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

  /* ===== ALWAYS FETCH + SAVE ON PAGE ENTRY ===== */
  useEffect(() => {
    let mounted = true;

    async function loadAndCache() {
      setLoading(true);
      try {
        const data = await fetchPersons();
        if (!mounted) return;

        // replace global state
        onUpdate(data);

        // replace local cache (authoritative snapshot)
        localStorage.setItem(STORAGE_KEYS.PERSONS, JSON.stringify(data));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAndCache();

    return () => {
      mounted = false;
    };
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

    // re-fetch + re-cache
    const data = await fetchPersons();
    onUpdate(data);
    localStorage.setItem(STORAGE_KEYS.PERSONS, JSON.stringify(data));

    setLoading(false);
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

    // re-fetch + re-cache
    const data = await fetchPersons();
    onUpdate(data);
    localStorage.setItem(STORAGE_KEYS.PERSONS, JSON.stringify(data));

    setLoading(false);
    setEditing(null);
    setError("");
  }

  /* ===== DELETE ===== */
  async function deletePerson(id) {
    setLoading(true);
    await deletePersonById(id);

    // re-fetch + re-cache
    const data = await fetchPersons();
    onUpdate(data);
    localStorage.setItem(STORAGE_KEYS.PERSONS, JSON.stringify(data));

    setLoading(false);
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
