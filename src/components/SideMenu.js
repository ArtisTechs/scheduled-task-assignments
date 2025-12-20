import { Nav } from "react-bootstrap";
import { NavLink } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function SideMenu({ onNavigate }) {
  const linkClass = ({ isActive }) =>
    [
      "nav-link",
      "text-white",
      "d-flex",
      "align-items-center",
      "px-3",
      "py-2",
      "rounded",
      isActive ? "bg-primary fw-semibold" : "text-opacity-75",
    ].join(" ");

  async function handleSignOut() {
    await signOut(auth);
    onNavigate?.();
  }

  return (
    <Nav className="flex-column p-2 gap-1 h-100">
      <NavLink to="/schedule" onClick={onNavigate} className={linkClass}>
        <i className="fas fa-calendar-alt me-2"></i>
        Meeting Schedule
      </NavLink>

      <NavLink to="/list" onClick={onNavigate} className={linkClass}>
        <i className="fas fa-users me-2"></i>
        User Assignment
      </NavLink>

      <NavLink to="/import-persons" onClick={onNavigate} className={linkClass}>
        <i className="fas fa-file-excel me-2"></i>
        Import Persons
      </NavLink>

      <div className="flex-grow-1"></div>

      {/* SIGN OUT */}
      <button
        type="button"
        className="nav-link text-white d-flex align-items-center px-3 py-2 rounded text-opacity-75 border-0 bg-transparent"
        onClick={handleSignOut}
      >
        <i className="fas fa-sign-out-alt me-2"></i>
        Sign out
      </button>
    </Nav>
  );
}
