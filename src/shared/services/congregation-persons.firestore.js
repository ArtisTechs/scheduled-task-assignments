import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase";

const ref = collection(db, "congregation_persons");

function toProperCase(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\b([a-z])/g, (ch) => ch.toUpperCase());
}

function normalizeStatus(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "inactive") return "inactive";
  if (normalized === "removed") return "removed";
  return "active";
}

function normalizePrivilege(data) {
  const value = data?.privilege ?? data?.previlage ?? data?.privilage ?? "";
  return toProperCase(value);
}

function normalizeRegularPioneer(value) {
  if (typeof value === "boolean") return value;

  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  return normalized === "yes" || normalized === "true";
}

function buildFullName(data = {}) {
  const firstName = toProperCase(data.firstName || "");
  const middleName = toProperCase(data.middleName || "");
  const lastName = toProperCase(data.lastName || "");

  const parts = [firstName, middleName, lastName].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");

  return String(data.name || "").trim();
}

function calculateAge(birthday) {
  if (!birthday) return null;

  const dob = new Date(birthday);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  const dayDiff = today.getDate() - dob.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

/* ===== READ ===== */
export async function fetchCongregationPersons() {
  const q = query(ref, orderBy("name"));
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() || {};

    const birthday = String(data.birthday || "").trim();
    const computedAge = calculateAge(birthday);
    const status = normalizeStatus(data.status);

    return {
      id: d.id,
      name: buildFullName(data),
      firstName: toProperCase(data.firstName || ""),
      middleName: toProperCase(data.middleName || ""),
      lastName: toProperCase(data.lastName || ""),
      status,
      age: Number.isFinite(Number(data.age))
        ? Number(data.age)
        : computedAge,
      privilege: normalizePrivilege(data),
      regularPioneer: normalizeRegularPioneer(data.regularPioneer),
      gender: toProperCase(data.gender || ""),
      contactNumber: String(data.contactNumber || "").trim(),
      birthday,
      baptismalDate: String(data.baptismalDate || "").trim(),
      removalDate:
        status === "removed"
          ? String(data.removalDate || data.dateOfRemoval || "").trim()
          : "",
    };
  });
}

/* ===== CREATE ===== */
export async function addCongregationPerson(person) {
  if (!person) return;

  const firstName = toProperCase(person.firstName || "");
  const middleName = toProperCase(person.middleName || "");
  const lastName = toProperCase(person.lastName || "");
  const privilege = toProperCase(person.privilege || "");
  const contactNumber = String(person.contactNumber || "").trim();
  const birthday = String(person.birthday || "").trim();
  const baptismalDate = String(person.baptismalDate || "").trim();
  const gender = toProperCase(person.gender || "");
  const status = normalizeStatus(person.status);
  const removalDate =
    status === "removed" ? String(person.removalDate || "").trim() : "";

  const name = [firstName, middleName, lastName].filter(Boolean).join(" ");

  await addDoc(ref, {
    name,
    firstName,
    middleName,
    lastName,
    status,
    privilege,
    previlage: privilege, // keep backward compatibility with legacy typo
    regularPioneer: Boolean(person.regularPioneer),
    gender,
    contactNumber,
    birthday,
    baptismalDate,
    removalDate,
    age: calculateAge(birthday),
    createdAt: serverTimestamp(),
  });
}

/* ===== UPDATE ===== */
export async function updateCongregationPerson(id, person) {
  if (!id || !person) return;

  const firstName = toProperCase(person.firstName || "");
  const middleName = toProperCase(person.middleName || "");
  const lastName = toProperCase(person.lastName || "");
  const privilege = toProperCase(person.privilege || "");
  const contactNumber = String(person.contactNumber || "").trim();
  const birthday = String(person.birthday || "").trim();
  const baptismalDate = String(person.baptismalDate || "").trim();
  const gender = toProperCase(person.gender || "");
  const status = normalizeStatus(person.status);
  const removalDate =
    status === "removed" ? String(person.removalDate || "").trim() : "";

  const name = [firstName, middleName, lastName].filter(Boolean).join(" ");

  const docRef = doc(db, "congregation_persons", id);
  await updateDoc(docRef, {
    name,
    firstName,
    middleName,
    lastName,
    status,
    privilege,
    previlage: privilege, // keep backward compatibility with legacy typo
    regularPioneer: Boolean(person.regularPioneer),
    gender,
    contactNumber,
    birthday,
    baptismalDate,
    removalDate,
    age: calculateAge(birthday),
    updatedAt: serverTimestamp(),
  });
}

/* ===== DELETE ===== */
export async function deleteCongregationPersonById(id) {
  if (!id) return;
  const docRef = doc(db, "congregation_persons", id);
  await deleteDoc(docRef);
}
