import { Nav } from "react-bootstrap";
import { NavLink } from "react-router-dom";

export default function SideMenu() {
  return (
    <Nav className="flex-column p-3 gap-2">
      <h6 className="text-white border-bottom pb-2 mb-3">
        Scheduler
      </h6>

      <Nav.Link
        as={NavLink}
        to="/"
        className="text-white d-flex align-items-center"
      >
        <i className="fas fa-users me-2"></i>
        User Assignment
      </Nav.Link>

      {/* future items */}
    </Nav>
  );
}
