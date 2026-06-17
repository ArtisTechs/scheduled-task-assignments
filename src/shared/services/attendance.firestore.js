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

const ref = collection(db, "attendance_records");

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDateValue(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    if (!Number.isNaN(date.getTime())) return date;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeAttendanceType(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "midweek") return "midweek";
  if (normalized === "weekend") return "weekend";
  return null;
}

function normalizeAttendanceRecord(id, data = {}) {
  const date = normalizeDateValue(data.date ?? data.attendanceDate ?? data.createdAt);
  const videoConferencingAttendance = normalizeNumber(
    data.videoConferencingAttendance ??
      data.onlineAttendance ??
      data.online ??
      data.onlineCount
  );
  const kingdomHallAttendance = normalizeNumber(
    data.kingdomHallAttendance ??
      data.offlineAttendance ??
      data.offline ??
      data.offlineCount
  );
  const totalAttendance = normalizeNumber(
    data.totalAttendance ?? data.total ?? data.attendanceTotal
  );
  const attendanceType = normalizeAttendanceType(
    data.attendanceType ?? data.type ?? data.scheduleType
  );

  return {
    id,
    date,
    dateKey: formatDateKey(date),
    month: date ? date.getMonth() + 1 : null,
    year: date ? date.getFullYear() : null,
    attendanceType,
    videoConferencingAttendance,
    kingdomHallAttendance,
    totalAttendance:
      totalAttendance ??
      ((videoConferencingAttendance ?? 0) + (kingdomHallAttendance ?? 0)),
  };
}

async function ensureNoDuplicateAttendanceForDate({ dateKey, ignoreId = null }) {
  if (!dateKey) return;

  const snap = await getDocs(query(ref, where("dateKey", "==", dateKey)));
  const conflict = snap.docs.some((docSnap) => {
    if (ignoreId && docSnap.id === ignoreId) return false;
    return true;
  });

  if (conflict) {
    throw new Error("An attendance record already exists for this date.");
  }
}

export async function fetchAttendanceRecords() {
  const snap = await getDocs(ref);
  const records = snap.docs.map((docSnap) =>
    normalizeAttendanceRecord(docSnap.id, docSnap.data())
  );

  return records.sort((a, b) => {
    const dateA = a.date ? a.date.getTime() : 0;
    const dateB = b.date ? b.date.getTime() : 0;
    if (dateA !== dateB) return dateB - dateA;

    return String(a.attendanceType || "").localeCompare(
      String(b.attendanceType || ""),
      undefined,
      { sensitivity: "base" }
    );
  });
}

export async function addAttendanceRecord(record) {
  if (!record) return;

  const date = normalizeDateValue(record.date);
  const attendanceType = normalizeAttendanceType(record.attendanceType);
  const videoConferencingAttendance = normalizeNumber(
    record.videoConferencingAttendance ?? record.onlineAttendance
  );
  const kingdomHallAttendance = normalizeNumber(
    record.kingdomHallAttendance ?? record.offlineAttendance
  );
  const totalAttendance = videoConferencingAttendance + kingdomHallAttendance;
  const dateKey = formatDateKey(date);

  if (!dateKey || !attendanceType) {
    throw new Error("Missing required attendance fields.");
  }

  if (
    videoConferencingAttendance === null ||
    kingdomHallAttendance === null ||
    videoConferencingAttendance < 0 ||
    kingdomHallAttendance < 0
  ) {
    throw new Error("Attendance counts must be 0 or greater.");
  }

  await ensureNoDuplicateAttendanceForDate({ dateKey });

  await addDoc(ref, {
    date,
    dateKey,
    month: date.getMonth() + 1,
    year: date.getFullYear(),
    attendanceType,
    videoConferencingAttendance,
    kingdomHallAttendance,
    totalAttendance,
    createdAt: serverTimestamp(),
  });
}

export async function updateAttendanceRecord(id, record) {
  if (!id || !record) return;

  const date = normalizeDateValue(record.date);
  const attendanceType = normalizeAttendanceType(record.attendanceType);
  const videoConferencingAttendance = normalizeNumber(
    record.videoConferencingAttendance ?? record.onlineAttendance
  );
  const kingdomHallAttendance = normalizeNumber(
    record.kingdomHallAttendance ?? record.offlineAttendance
  );
  const totalAttendance = videoConferencingAttendance + kingdomHallAttendance;
  const dateKey = formatDateKey(date);

  if (!dateKey || !attendanceType) {
    throw new Error("Missing required attendance fields.");
  }

  if (
    videoConferencingAttendance === null ||
    kingdomHallAttendance === null ||
    videoConferencingAttendance < 0 ||
    kingdomHallAttendance < 0
  ) {
    throw new Error("Attendance counts must be 0 or greater.");
  }

  await ensureNoDuplicateAttendanceForDate({ dateKey, ignoreId: id });

  const docRef = doc(db, "attendance_records", id);
  await updateDoc(docRef, {
    date,
    dateKey,
    month: date.getMonth() + 1,
    year: date.getFullYear(),
    attendanceType,
    videoConferencingAttendance,
    kingdomHallAttendance,
    totalAttendance,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAttendanceRecordById(id) {
  if (!id) return;
  const docRef = doc(db, "attendance_records", id);
  await deleteDoc(docRef);
}
