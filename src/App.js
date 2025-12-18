import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Offcanvas } from "react-bootstrap";
import Header from "./components/Header";
import SideMenu from "./components/SideMenu";
import UserAssignmentPage from "./pages/UserAssignmentPage";
import ImportPersons from "./pages/ImportPersonsPage";
import { STORAGE_KEYS } from "./shared/keys/storage.keys";
import ScheduleMainPage from "./pages/ScheduledMainPage";
import "./shared/styles/global.styles.css";
import { listenToast, removeToastListener } from "./shared/services/toast.service";

export default function App() {
  const [showMenu, setShowMenu] = useState(false);
  const [persons, setPersons] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  /* ---- GLOBAL TOAST ---- */
  const [toast, setToast] = useState({ show: false, message: "" });

  useEffect(() => {
    function onToast(e) {
      setToast({ show: true, message: e.detail || "Saved successfully." });
      setTimeout(() => setToast({ show: false, message: "" }), 2500);
    }

    listenToast(onToast);
    return () => removeToastListener(onToast);
  }, []);

  /* ---- load persons ---- */
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PERSONS);
    if (saved) {
      try {
        setPersons(JSON.parse(saved));
      } catch {
        setPersons([]);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEYS.PERSONS, JSON.stringify(persons));
  }, [persons, hydrated]);

  return (
    <BrowserRouter>
      <Header onToggle={() => setShowMenu(true)} />

      {/* GLOBAL TOAST */}
      {toast.show && (
        <div
          className="toast show position-fixed top-0 end-0 m-3"
          role="alert"
          style={{ zIndex: 2000 }}
        >
          <div className="toast-header">
            <strong className="me-auto">Scheduler</strong>
            <button
              type="button"
              className="btn-close"
              onClick={() => setToast({ show: false, message: "" })}
            />
          </div>
          <div className="toast-body">{toast.message}</div>
        </div>
      )}

      <Offcanvas
        show={showMenu}
        onHide={() => setShowMenu(false)}
        placement="start"
        backdrop
        className="bg-dark text-white"
      >
        <Offcanvas.Header>
          <Offcanvas.Title>Scheduler</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="p-0">
          <SideMenu onNavigate={() => setShowMenu(false)} />
        </Offcanvas.Body>
      </Offcanvas>

      <div className="container-fluid p-4">
        <Routes>
          <Route path="/" element={<Navigate to="/schedule" replace />} />
          <Route
            path="/list"
            element={
              <UserAssignmentPage persons={persons} onUpdate={setPersons} />
            }
          />
          <Route
            path="/import-persons"
            element={<ImportPersons persons={persons} onUpdate={setPersons} />}
          />
          <Route path="/schedule" element={<ScheduleMainPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
