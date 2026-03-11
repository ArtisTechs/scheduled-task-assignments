import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";

const ref = collection(db, "field_service_reports");

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  return normalized === "yes" || normalized === "true" || normalized === "1";
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMonth(value) {
  if (typeof value === "number" && value >= 1 && value <= 12) {
    return value;
  }

  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber >= 1 && asNumber <= 12) {
    return asNumber;
  }

  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!normalized) return null;

  const monthIndex = MONTHS.findIndex(
    (month) => month === normalized || month.startsWith(normalized)
  );

  return monthIndex >= 0 ? monthIndex + 1 : null;
}

function normalizeYear(value) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 1900) return parsed;
  return null;
}

function extractDateParts(data = {}) {
  const dateCandidate =
    data.reportDate || data.serviceDate || data.date || data.createdAt || "";

  if (!dateCandidate) return { month: null, year: null };

  if (typeof dateCandidate?.toDate === "function") {
    const date = dateCandidate.toDate();
    if (!Number.isNaN(date.getTime())) {
      return { month: date.getMonth() + 1, year: date.getFullYear() };
    }
  }

  const parsed = new Date(dateCandidate);
  if (Number.isNaN(parsed.getTime())) return { month: null, year: null };

  return { month: parsed.getMonth() + 1, year: parsed.getFullYear() };
}

function normalizeReportData(id, data = {}) {
  const fallbackDateParts = extractDateParts(data);
  const month =
    normalizeMonth(data.month ?? data.reportMonth ?? data.serviceMonth) ??
    fallbackDateParts.month;
  const year =
    normalizeYear(data.year ?? data.reportYear ?? data.serviceYear) ??
    fallbackDateParts.year;

  return {
    id,
    personId: String(data.personId ?? "").trim(),
    personName: String(data.personName ?? data.name ?? data.person ?? "")
      .trim(),
    sharedMinistry: normalizeBoolean(
      data.sharedMinistry ?? data.sharedInMinistry ?? data.shareMinistry
    ),
    regularPioneer: normalizeBoolean(data.regularPioneer),
    auxiliaryPioneer: normalizeBoolean(
      data.auxiliaryPioneer ?? data.auxilliaryPioneer ?? data.auxPioneer
    ),
    hours: normalizeNumber(data.hours ?? data.numberOfHours ?? data.totalHours),
    bibleStudies: normalizeNumber(
      data.bibleStudies ?? data.bibleStudy ?? data.numberOfBibleStudies
    ),
    month,
    year,
  };
}

function normalizeString(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function toMonthYear(data = {}) {
  const month = normalizeMonth(data.month);
  const year = normalizeYear(data.year);
  return { month, year };
}

async function ensureNoDuplicateReportForPeriod({
  personId,
  personName,
  month,
  year,
  ignoreId = null,
}) {
  const normalizedPersonId = String(personId || "").trim();
  const normalizedPersonName = normalizeString(personName);

  const snapshots = await Promise.all([
    normalizedPersonId
      ? getDocs(query(ref, where("personId", "==", normalizedPersonId)))
      : Promise.resolve(null),
    normalizedPersonName
      ? getDocs(query(ref, where("personName", "==", personName)))
      : Promise.resolve(null),
  ]);

  const candidates = new Map();
  for (const snap of snapshots) {
    if (!snap) continue;
    for (const docSnap of snap.docs) {
      candidates.set(docSnap.id, docSnap.data() || {});
    }
  }

  const hasConflict = [...candidates.entries()].some(([docId, data]) => {
    if (ignoreId && docId === ignoreId) return false;

    const period = toMonthYear(data);
    if (period.month !== month || period.year !== year) return false;

    const candidatePersonId = String(data.personId || "").trim();
    if (normalizedPersonId && candidatePersonId) {
      return candidatePersonId === normalizedPersonId;
    }

    return normalizeString(data.personName) === normalizedPersonName;
  });

  if (hasConflict) {
    throw new Error(
      "A report for this person already exists for the selected month and year."
    );
  }
}

export async function fetchFieldServiceReports() {
  const snap = await getDocs(ref);

  const reports = snap.docs.map((docSnap) =>
    normalizeReportData(docSnap.id, docSnap.data())
  );

  return reports.sort((a, b) => {
    const yearA = a.year ?? 0;
    const yearB = b.year ?? 0;
    if (yearA !== yearB) return yearB - yearA;

    const monthA = a.month ?? 0;
    const monthB = b.month ?? 0;
    if (monthA !== monthB) return monthB - monthA;

    return a.personName.localeCompare(b.personName, undefined, {
      sensitivity: "base",
    });
  });
}

export async function addFieldServiceReport(report) {
  if (!report) return;

  const personId = String(report.personId || "").trim();
  const personName = String(report.personName || "").trim();
  const month = normalizeMonth(report.month);
  const year = normalizeYear(report.year);

  if (!personName || !month || !year) {
    throw new Error("Missing required report fields.");
  }

  await ensureNoDuplicateReportForPeriod({
    personId,
    personName,
    month,
    year,
  });

  const regularPioneer = normalizeBoolean(report.regularPioneer);
  const auxiliaryPioneer = normalizeBoolean(report.auxiliaryPioneer);
  const hours = normalizeNumber(report.hours);
  const bibleStudies = normalizeNumber(report.bibleStudies) ?? 0;

  let sharedMinistry = normalizeBoolean(report.sharedMinistry);
  if ((regularPioneer || auxiliaryPioneer) && (hours ?? 0) > 0) {
    sharedMinistry = true;
  }

  await addDoc(ref, {
    personId,
    personName,
    month,
    year,
    regularPioneer,
    auxiliaryPioneer,
    auxilliaryPioneer: auxiliaryPioneer, // compatibility for misspelled field
    hours: regularPioneer || auxiliaryPioneer ? hours ?? 0 : null,
    bibleStudies,
    sharedMinistry,
    createdAt: serverTimestamp(),
  });
}

export async function updateFieldServiceReport(id, report) {
  if (!id || !report) return;

  const personId = String(report.personId || "").trim();
  const personName = String(report.personName || "").trim();
  const month = normalizeMonth(report.month);
  const year = normalizeYear(report.year);

  if (!personName || !month || !year) {
    throw new Error("Missing required report fields.");
  }

  await ensureNoDuplicateReportForPeriod({
    personId,
    personName,
    month,
    year,
    ignoreId: id,
  });

  const regularPioneer = normalizeBoolean(report.regularPioneer);
  const auxiliaryPioneer = normalizeBoolean(report.auxiliaryPioneer);
  const hours = normalizeNumber(report.hours);
  const bibleStudies = normalizeNumber(report.bibleStudies) ?? 0;

  let sharedMinistry = normalizeBoolean(report.sharedMinistry);
  if ((regularPioneer || auxiliaryPioneer) && (hours ?? 0) > 0) {
    sharedMinistry = true;
  }

  const docRef = doc(db, "field_service_reports", id);
  await updateDoc(docRef, {
    personId,
    personName,
    month,
    year,
    regularPioneer,
    auxiliaryPioneer,
    auxilliaryPioneer: auxiliaryPioneer, // compatibility for misspelled field
    hours: regularPioneer || auxiliaryPioneer ? hours ?? 0 : null,
    bibleStudies,
    sharedMinistry,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFieldServiceReportById(id) {
  if (!id) return;
  const docRef = doc(db, "field_service_reports", id);
  await deleteDoc(docRef);
}
