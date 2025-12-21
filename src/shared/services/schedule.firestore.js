// src/shared/services/schedule.firestore.js
import { db } from "../../firebase";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";

import { STORAGE_KEYS } from "../keys/storage.keys";

const COLLECTION = "schedules";

/* ===== SAVE SINGLE WEEK ===== */
export async function saveWeeklySchedule(weekStart, schedule) {
  const ref = doc(db, COLLECTION, weekStart);
  await setDoc(ref, {
    weekStart,
    schedule,
    updatedAt: Date.now(),
  });
}

/* ===== FETCH ALL SCHEDULES ===== */
export async function fetchAllSchedules() {
  const snap = await getDocs(collection(db, COLLECTION));

  const all = {};
  snap.forEach((d) => {
    const data = d.data();
    if (data?.weekStart && data?.schedule) {
      all[data.weekStart] = data.schedule;
    }
  });

  return all;
}

/* ===== FETCH → CACHE LOCALLY ===== */
export async function fetchAllSchedulesAndCache() {
  const all = await fetchAllSchedules();

  localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(all));

  return all;
}
