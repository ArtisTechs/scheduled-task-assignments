import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Offcanvas } from "react-bootstrap";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { auth } from "./firebase";
import { fetchPersons } from "./shared/services/persons.firestore";
import { fetchAllSchedulesAndCache } from "./shared/services/schedule.firestore";
import { STORAGE_KEYS } from "./shared/keys/storage.keys";

import Header from "./components/Header";
import SideMenu from "./components/SideMenu";
import UserAssignmentPage from "./pages/UserAssignmentPage";
import ImportPersons from "./pages/ImportPersonsPage";
import ScheduleMainPage from "./pages/ScheduledMainPage";
import LoginPage from "./pages/LoginPage";
import FullscreenLoader from "./components/FullscreenLoader";

import "./shared/styles/global.styles.css";
import {
  listenToast,
  removeToastListener,
} from "./shared/services/toast.service";

export default function App() {
  const [showMenu, setShowMenu] = useState(false);
  const [persons, setPersons] = useState([]);

  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  const [toast, setToast] = useState({ show: false, message: "" });

  /* ===== TOAST ===== */
  useEffect(() => {
    function onToast(e) {
      setToast({ show: true, message: e.detail || "Saved successfully." });
      setTimeout(() => setToast({ show: false, message: "" }), 2500);
    }
    listenToast(onToast);
    return () => removeToastListener(onToast);
  }, []);

  /* ===== AUTH + INITIAL DATA BOOTSTRAP ===== */
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthReady(true);

      if (!u) {
        setPersons([]);
        localStorage.removeItem(STORAGE_KEYS.PERSONS);
        localStorage.removeItem(STORAGE_KEYS.SCHEDULES);
        setBootstrapping(false);
        return;
      }

      setBootstrapping(true);

      /* ---- PERSONS (cache-first) ---- */
      const cachedPersons = localStorage.getItem(STORAGE_KEYS.PERSONS);
      if (cachedPersons) {
        try {
          setPersons(JSON.parse(cachedPersons));
        } catch {
          localStorage.removeItem(STORAGE_KEYS.PERSONS);
        }
      } else {
        const personsData = await fetchPersons();
        setPersons(personsData);
        localStorage.setItem(STORAGE_KEYS.PERSONS, JSON.stringify(personsData));
      }

      /* ---- SCHEDULES (always fetch once) ---- */
      await fetchAllSchedulesAndCache();

      setBootstrapping(false);
    });
  }, []);

  /* ===== FULLSCREEN LOADER ===== */
  if (!authReady || bootstrapping) {
    return <FullscreenLoader text="Preparing application…" />;
  }

  return (
    <>
      {user && (
        <>
          <Header
            onToggle={() => setShowMenu(true)}
            onLogout={() => signOut(auth)}
          />

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
        </>
      )}

      {toast.show && (
        <div
          className="toast show position-fixed top-0 end-0 m-3"
          style={{ zIndex: 2000 }}
        >
          <div className="toast-header">
            <strong className="me-auto">Scheduler</strong>
            <button
              className="btn-close"
              onClick={() => setToast({ show: false, message: "" })}
            />
          </div>
          <div className="toast-body">{toast.message}</div>
        </div>
      )}

      <div className="container-fluid p-4">
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to="/schedule" replace /> : <LoginPage />}
          />

          <Route
            path="/"
            element={
              user ? (
                <Navigate to="/schedule" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/schedule"
            element={
              user ? <ScheduleMainPage /> : <Navigate to="/login" replace />
            }
          />

          <Route
            path="/list"
            element={
              user ? (
                <UserAssignmentPage persons={persons} onUpdate={setPersons} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/import-persons"
            element={
              user ? (
                <ImportPersons persons={persons} onUpdate={setPersons} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="*"
            element={<Navigate to={user ? "/schedule" : "/login"} replace />}
          />
        </Routes>
      </div>
    </>
  );
}
