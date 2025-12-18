import { ROLES } from "./Roles";

export const SCHEDULE_TEMPLATE = {
  chairman: {
    label: "Chairman",
    allowedRoles: [ROLES.ELDER],
    assignee: "",
  },

  openingSong: "",
  pamumuhaySong: "",
  closingSong: "",

  sections: [
    {
      key: "KAYAMANAN",
      title: "KAYAMANAN MULA SA SALITA NG DIYOS",
      fixed: true,
      items: [
        {
          key: "TALK",
          title: "Talk",
          duration: 10,
          titleEditable: true,
          durationEditable: false,
          allowedRoles: [ROLES.ELDER, ROLES.MS],
          maxAssignees: 1,
          fixed: true,
        },
        {
          key: "HIYAS",
          title: "Espiritwal na Hiyas",
          duration: 10,
          titleEditable: false,
          durationEditable: false,
          allowedRoles: [ROLES.ELDER, ROLES.MS],
          maxAssignees: 1,
          fixed: true,
        },
        {
          key: "BIBLE_READING",
          title: "Pagbabasa ng Bibliya",
          duration: 4,
          titleEditable: false,
          durationEditable: false,
          allowedRoles: [ROLES.BIBLE_READER],
          maxAssignees: 1,
          fixed: true,
        },
      ],
    },

    {
      key: "MINISTERYO",
      title: "MAGING MAHUSAY SA MINISTERYO",
      fixed: true,
      rotatableTitles: [
        "Pagpapasimula ng pakikipagusap",
        "Pakikipag-usap muli",
        "Pagdalaw muli",
        "Pagawa ng mga Alagad",
        "Ipaliwanag ang Paniniwala mo",
        "Pahayag",
      ],
      items: [],
    },

    {
      key: "PAMUMUHAY",
      title: "PAMUMUHAY BILANG KRISTIYANO",
      fixed: true,
      items: [
        {
          key: "LOCAL",
          title: "Local na Pangangailangan",
          duration: 15,
          titleEditable: true,
          durationEditable: true,
          allowedRoles: [ROLES.ELDER, ROLES.MS],
          maxAssignees: 1,
          fixed: false,
        },
        {
          key: "CBS",
          title: "Pag-aaral ng Kongregasyon sa Bibliya",
          duration: 30,
          titleEditable: false,
          allowedRoles: [ROLES.ELDER],
          maxAssignees: 1,
          fixed: true,
        },
      ],
    },
  ],

  prayer: {
    label: "Panalangin",
    allowedRoles: [ROLES.ELDER, ROLES.MS],
    assignee: "",
  },
};

export const MINISTERYO_RULES = {
  "Pagpapasimula ng pakikipagusap": {
    allowedRoles: [ROLES.STUDENT],
    maxAssignees: 2,
  },
  "Pakikipag-usap muli": {
    allowedRoles: [ROLES.STUDENT],
    maxAssignees: 2,
  },
  "Pagdalaw muli": {
    allowedRoles: [ROLES.STUDENT],
    maxAssignees: 2,
  },
  "Pagawa ng mga Alagad": {
    allowedRoles: [ROLES.STUDENT],
    maxAssignees: 2,
  },
  "Ipaliwanag ang Paniniwala mo": {
    allowedRoles: [ROLES.STUDENT],
    maxAssignees: 2,
  },
  Pahayag: {
    allowedRoles: [ROLES.STUDENT_PAHAYAG],
    maxAssignees: 1,
  },
};