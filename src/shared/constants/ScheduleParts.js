import { ROLES } from "./Roles";

export const DEFAULT_PARTS = [
  {
    id: "min-1",
    section: "MAGING MAHUSAY SA MINISTERYO",
    title: "Pagpapasimula ng Pakikipag-usap",
    duration: 3,
    allowedRoles: [ROLES.STUDENT, ROLES.ASSISTANT],
    maxAssignees: 2,
  },
  {
    id: "min-2",
    section: "MAGING MAHUSAY SA MINISTERYO",
    title: "Pagdalaw-Muli",
    duration: 5,
    allowedRoles: [ROLES.STUDENT, ROLES.ASSISTANT],
    maxAssignees: 2,
  },
  {
    id: "pam-1",
    section: "PAMUMUHAY BILANG KRISTIYANO",
    title: "Pag-aaral ng Kongregasyon sa Bibliya",
    duration: 30,
    allowedRoles: [ROLES.CONDUCTOR],
    maxAssignees: 1,
  },
];
