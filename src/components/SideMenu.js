import { Nav } from "react-bootstrap";
import { NavLink } from "react-router-dom";

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

  return (
    <Nav className="flex-column p-2 gap-1">
      <NavLink to="/" onClick={onNavigate} className={linkClass}>
        <i className="fas fa-users me-2"></i>
        User Assignment
      </NavLink>

      <NavLink to="/import-persons" onClick={onNavigate} className={linkClass}>
        <i className="fas fa-file-excel me-2"></i>
        Import Persons
      </NavLink>
    </Nav>
  );
}
