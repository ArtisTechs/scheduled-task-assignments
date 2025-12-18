import React from "react";

const CBS_KEY = "CBS";

export default function ScheduleTableView({ schedule, persons }) {
  let partNumber = 1;

  function getPersonName(id) {
    return persons.find((p) => p.id === id)?.name || "—";
  }

  function getAssigneesText(ids = []) {
    if (!ids.length) return "—";
    return ids.map(getPersonName).join(" / ");
  }

  function getPamumuhayItems(section) {
    const cbs = section.items.find((i) => i.key === CBS_KEY);
    const others = section.items.filter((i) => i.key !== CBS_KEY);
    return cbs ? [...others, cbs] : others;
  }

  return (
    <table className="table table-bordered align-middle">
      <tbody>
        {/* ================= CHAIRMAN ================= */}
        <tr className="table-light fw-semibold">
          <td colSpan="2">Chairman</td>
          <td>{getPersonName(schedule.chairman.assignee)}</td>
        </tr>

        {/* ================= OPENING SONG ================= */}
        <tr>
          <td colSpan="3">Awit Blg. {schedule.openingSong || "—"}</td>
        </tr>

        {/* ================= SECTIONS ================= */}
        {schedule.sections.map((section) => {
          const items =
            section.key === "PAMUMUHAY"
              ? getPamumuhayItems(section)
              : section.items;

          return (
            <React.Fragment key={section.key}>
              {/* SECTION HEADER */}
              <tr
                className={`section-header section-${section.key.toLowerCase()}`}
              >
                <td colSpan="3">{section.title}</td>
              </tr>

              {/* PAMUMUHAY SONG (FIRST, BEFORE PARTS) */}
              {section.key === "PAMUMUHAY" && (
                <tr>
                  <td colSpan="3">Awit Blg. {schedule.pamumuhaySong || "—"}</td>
                </tr>
              )}

              {/* ITEMS */}
              {items.map((item) => (
                <tr key={item.key}>
                  <td>
                    <strong>{partNumber++}.</strong>&nbsp;{item.title}
                  </td>
                  <td width="140">{item.duration} min</td>
                  <td className="fw-bold">{getAssigneesText(item.assignees)}</td>
                </tr>
              ))}
            </React.Fragment>
          );
        })}

        {/* ================= CLOSING SONG ================= */}
        <tr>
          <td colSpan="3">Awit Blg. {schedule.closingSong || "—"}</td>
        </tr>

        {/* ================= PRAYER ================= */}
        <tr className="table-light fw-semibold">
          <td colSpan="2">Panalangin</td>
          <td>{getPersonName(schedule.prayer.assignee)}</td>
        </tr>
      </tbody>
    </table>
  );
}
