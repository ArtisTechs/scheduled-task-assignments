import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";

import FullscreenLoader from "../components/FullscreenLoader";
import { addPersonsBulk } from "../shared/services/persons.firestore";

export default function ImportPersons({ persons = [], onUpdate }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function onFileSelect(e) {
    setFile(e.target.files[0] || null);
    setError("");
    setSuccess("");
  }

  function toCamelCaseName(value) {
    return value
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  async function handleImport() {
    if (!file) {
      setError("Please select an Excel file.");
      return;
    }

    setLoading(true);

    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        const sheetName = workbook.SheetNames?.[0];
        if (!sheetName) {
          setError("Excel file has no sheets.");
          return;
        }

        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (!rows.length) {
          setError("Excel file is empty.");
          return;
        }

        const headers = Object.keys(rows[0]);
        const nameKey = headers.find((h) => h.toLowerCase().includes("name"));

        if (!nameKey) {
          setError("No column containing 'name' found.");
          return;
        }

        const names = rows
          .map((r) => toCamelCaseName(String(r[nameKey]).trim()))
          .filter(Boolean);

        if (!names.length) {
          setError("No valid names found.");
          return;
        }

        const existing = new Set(
          persons.map((p) => p?.name?.toLowerCase()).filter(Boolean)
        );

        const newPersons = names
          .filter((n) => !existing.has(n.toLowerCase()))
          .map((name) => ({
            name,
            roles: [], // Firestore schema
          }));

        if (!newPersons.length) {
          setError("All names already exist.");
          return;
        }

        await addPersonsBulk(newPersons);

        onUpdate((prev) =>
          [...prev, ...newPersons].sort((a, b) => a.name.localeCompare(b.name))
        );

        setFile(null);
        if (fileRef.current) fileRef.current.value = "";

        setError("");
        setSuccess(`${newPersons.length} names imported successfully.`);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to process Excel file.");
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setLoading(false);
      setError("Failed to read file.");
    };

    reader.readAsArrayBuffer(file);
  }

  return (
    <>
      {loading && <FullscreenLoader text="Importing persons…" />}

      <div className="card p-3">
        <h5 className="mb-3">Import Persons</h5>

        {success && <div className="alert alert-success py-2">{success}</div>}

        {error && <div className="alert alert-danger py-2">{error}</div>}

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={onFileSelect}
          className="form-control mb-3"
        />

        <div className="d-flex justify-content-center">
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={!file || loading}
          >
            Import
          </button>
        </div>

        <small className="text-muted d-block mt-2">
          Excel must contain a column with the word <strong>name</strong>.
        </small>
      </div>
    </>
  );
}
