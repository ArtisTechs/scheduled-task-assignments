import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Offcanvas } from "react-bootstrap";
import Header from "./components/Header";
import SideMenu from "./components/SideMenu";
import UserAssignmentPage from "./pages/UserAssignmentPage";
import ImportPersons from "./pages/ImportPersonsPage";
import { STORAGE_KEYS } from "./shared/keys/storage.keys";
import ScheduleMainPage from "./pages/ScheduledMainPage";

export default function App() {
  const [showMenu, setShowMenu] = useState(false);
  const [persons, setPersons] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  // 1️⃣ Load from storage once
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

  // 2️⃣ Save only AFTER hydration
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEYS.PERSONS, JSON.stringify(persons));
  }, [persons, hydrated]);

  return (
    <BrowserRouter>
      <Header onToggle={() => setShowMenu(true)} />

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
          <Route
            path="/"
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
