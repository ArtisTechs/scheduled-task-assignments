import Spinner from "react-bootstrap/Spinner";

export default function FullscreenLoader({ text = "Loading…" }) {
  return (
    <div
      className="d-flex align-items-center justify-content-center"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(76, 76, 76, 0.85)",
        zIndex: 3000,
      }}
    >
      <div className="text-center text-white">
        <Spinner animation="border" role="status" />
        <div className="mt-2 fw-semibold">{text}</div>
      </div>
    </div>
  );
}
