import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Offcanvas } from "react-bootstrap";
import Header from "./components/Header";
import SideMenu from "./components/SideMenu";
import UserAssignmentPage from "./pages/UserAssignmentPage";

export default function App() {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <BrowserRouter>
      <Header onToggle={() => setShowMenu(true)} />

      <Offcanvas
        show={showMenu}
        onHide={() => setShowMenu(false)}
        backdrop
        placement="start"
        className="bg-dark text-white"
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Scheduler</Offcanvas.Title>
        </Offcanvas.Header>

        <Offcanvas.Body className="p-0">
          <SideMenu onNavigate={() => setShowMenu(false)} />
        </Offcanvas.Body>
      </Offcanvas>

      <div className="container-fluid">
        <div className="p-4">
          <Routes>
            <Route path="/" element={<UserAssignmentPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
