export default function Header({ collapsed, onToggle }) {
  return (
    <nav
      className="navbar navbar-dark bg-dark px-3 sticky-top"
      style={{ height: "56px", zIndex: 1030 }}
    >
      <button className="btn btn-outline-light btn-sm me-3" onClick={onToggle}>
        ☰
      </button>

      <span className="navbar-brand mb-0 h6 d-flex align-items-center gap-2">
        <i className="fa-solid fa-business-time"></i>
        CMS
      </span>
    </nav>
  );
}
