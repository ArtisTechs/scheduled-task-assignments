import React from "react";
import { ROLES } from "../shared/constants/Roles";
import { MINISTERYO_RULES } from "../shared/constants";

const CBS_KEY = "CBS";

export default function EditableScheduleTable({ schedule, persons, onChange }) {
  /* =========================
     HELPERS
  ========================= */
  function clone() {
    return JSON.parse(JSON.stringify(schedule));
  }

  function eligiblePersons(allowedRoles) {
    return persons.filter((p) =>
      p.roles?.some((r) => allowedRoles.includes(r))
    );
  }

  function update(path, value) {
    const copy = clone();
    let ref = copy;
    for (let i = 0; i < path.length - 1; i++) ref = ref[path[i]];
    ref[path.at(-1)] = value;
    onChange(copy);
  }

  function removeItem(sectionIndex, itemIndex) {
    const copy = clone();
    copy.sections[sectionIndex].items.splice(itemIndex, 1);
    onChange(copy);
  }

  function addMinistryItem(sectionIndex, section) {
    const used = section.items.map((i) => i.title);
    const nextTitle =
      Object.keys(MINISTERYO_RULES).find((t) => !used.includes(t)) ||
      Object.keys(MINISTERYO_RULES)[0];

    const rule = MINISTERYO_RULES[nextTitle];

    const copy = clone();
    copy.sections[sectionIndex].items.push({
      key: crypto.randomUUID(),
      title: nextTitle,
      duration: 3,
      titleEditable: true,
      durationEditable: true,
      allowedRoles: rule.allowedRoles,
      maxAssignees: rule.maxAssignees,
      fixed: false,
      assignees: [],
    });

    onChange(copy);
  }

  function addPamumuhayItem(sectionIndex) {
    const copy = clone();
    const items = copy.sections[sectionIndex].items;

    const newItem = {
      key: crypto.randomUUID(),
      title: "Local na Pangangailangan",
      duration: 15,
      titleEditable: true,
      durationEditable: true,
      allowedRoles: [ROLES.ELDER, ROLES.MS],
      maxAssignees: 1,
      fixed: false,
      assignees: [],
    };

    const cbsIndex = items.findIndex((i) => i.key === CBS_KEY);
    if (cbsIndex === -1) items.push(newItem);
    else items.splice(cbsIndex, 0, newItem);

    onChange(copy);
  }

  function normalizePamumuhay(section) {
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
          <td>
            <select
              className="form-select"
              value={schedule.chairman.assignee}
              onChange={(e) => update(["chairman", "assignee"], e.target.value)}
            >
              <option value="">—</option>
              {eligiblePersons(schedule.chairman.allowedRoles).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </td>
        </tr>

        {/* ================= OPENING SONG ================= */}
        <tr>
          <td colSpan="3">
            Awit Blg.&nbsp;
            <input
              className="form-control d-inline w-auto"
              value={schedule.openingSong}
              onChange={(e) => update(["openingSong"], e.target.value)}
            />
          </td>
        </tr>

        {/* ================= SECTIONS ================= */}
        {schedule.sections.map((section, si) => {
          const items =
            section.key === "PAMUMUHAY"
              ? normalizePamumuhay(section)
              : section.items;

          return (
            <React.Fragment key={section.key}>
              <tr
                className={`section-header section-${section.key.toLowerCase()}`}
              >
                <td colSpan="3">{section.title}</td>
              </tr>

              {section.key === "PAMUMUHAY" && (
                <tr>
                  <td colSpan="3">
                    Awit Blg.&nbsp;
                    <input
                      className="form-control d-inline w-auto"
                      value={schedule.pamumuhaySong}
                      onChange={(e) =>
                        update(["pamumuhaySong"], e.target.value)
                      }
                    />
                  </td>
                </tr>
              )}

              {items.map((item, ii) => (
                <tr key={item.key}>
                  {/* TITLE */}
                  <td>
                    {section.key === "MINISTERYO" ? (
                      <select
                        className="form-select"
                        value={item.title}
                        onChange={(e) => {
                          const newTitle = e.target.value;
                          const rule = MINISTERYO_RULES[newTitle];

                          update(["sections", si, "items", ii], {
                            ...item,
                            title: newTitle,
                            allowedRoles: rule.allowedRoles,
                            maxAssignees: rule.maxAssignees,
                            assignees: [],
                          });
                        }}
                      >
                        {Object.keys(MINISTERYO_RULES).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    ) : item.titleEditable ? (
                      <input
                        className="form-control"
                        value={item.title}
                        onChange={(e) =>
                          update(
                            ["sections", si, "items", ii, "title"],
                            e.target.value
                          )
                        }
                      />
                    ) : (
                      item.title
                    )}
                  </td>

                  {/* DURATION */}
                  <td width="120">
                    {item.durationEditable ? (
                      <input
                        type="number"
                        className="form-control"
                        value={item.duration}
                        onChange={(e) =>
                          update(
                            ["sections", si, "items", ii, "duration"],
                            +e.target.value
                          )
                        }
                      />
                    ) : (
                      `${item.duration} min`
                    )}
                  </td>

                  {/* ASSIGNEES (SLOT-BASED) */}
                  <td>
                    {Array.from({ length: item.maxAssignees }).map(
                      (_, slotIndex) => (
                        <select
                          key={slotIndex}
                          className="form-select mb-1"
                          value={item.assignees?.[slotIndex] || ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            const updated = [...(item.assignees || [])];
                            updated[slotIndex] = value;

                            update(
                              ["sections", si, "items", ii, "assignees"],
                              updated.filter(Boolean)
                            );
                          }}
                        >
                          <option value="">Select person</option>
                          {eligiblePersons(item.allowedRoles).map((p) => (
                            <option
                              key={p.id}
                              value={p.id}
                              disabled={item.assignees?.includes(p.id)}
                            >
                              {p.name}
                            </option>
                          ))}
                        </select>
                      )
                    )}

                    {!item.fixed && item.key !== CBS_KEY && (
                      <button
                        className="btn btn-sm btn-outline-danger mt-1"
                        onClick={() => removeItem(si, ii)}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {/* ADD BUTTONS */}
              {section.key === "MINISTERYO" && (
                <tr>
                  <td colSpan="3">
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => addMinistryItem(si, section)}
                    >
                      + Add Ministry Part
                    </button>
                  </td>
                </tr>
              )}

              {section.key === "PAMUMUHAY" && (
                <tr>
                  <td colSpan="3">
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => addPamumuhayItem(si)}
                    >
                      + Add Pamumuhay Part
                    </button>
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}

        {/* ================= CLOSING SONG ================= */}
        <tr>
          <td colSpan="3">
            Awit Blg.&nbsp;
            <input
              className="form-control d-inline w-auto"
              value={schedule.closingSong}
              onChange={(e) => update(["closingSong"], e.target.value)}
            />
          </td>
        </tr>

        {/* ================= PRAYER ================= */}
        <tr className="table-light fw-semibold">
          <td colSpan="2">Panalangin</td>
          <td>
            <select
              className="form-select"
              value={schedule.prayer.assignee}
              onChange={(e) => update(["prayer", "assignee"], e.target.value)}
            >
              <option value="">—</option>
              {eligiblePersons(schedule.prayer.allowedRoles).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
