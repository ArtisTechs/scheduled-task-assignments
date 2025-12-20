import {
  collection,
  getDocs,
  addDoc,
  writeBatch,
  query,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../firebase";

const ref = collection(db, "persons");

/* ===== READ ===== */
export async function fetchPersons() {
  const q = query(ref, orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ===== BULK CREATE ===== */
export async function addPersonsBulk(persons = []) {
  if (!Array.isArray(persons) || persons.length === 0) return;

  const batch = writeBatch(db);
  let writeCount = 0;

  for (const p of persons) {
    if (!p || typeof p.name !== "string" || !p.name.trim()) continue;

    const docRef = doc(ref);

    batch.set(docRef, {
      name: p.name.trim(),
      roles: Array.isArray(p.roles) ? p.roles : [],
      createdAt: serverTimestamp(),
    });

    writeCount++;
  }

  if (writeCount === 0) return;

  await batch.commit();
}

/* ===== CREATE ===== */
export async function addPerson(person) {
  if (!person || !person.name) return;

  await addDoc(ref, {
    name: person.name.trim(),
    roles: Array.isArray(person.roles) ? person.roles : [],
    createdAt: serverTimestamp(),
  });
}

/* ===== UPDATE ===== */
export async function updatePerson(id, person) {
  if (!id || !person || !person.name) return;

  const docRef = doc(db, "persons", id);

  await updateDoc(docRef, {
    name: person.name.trim(),
    roles: Array.isArray(person.roles) ? person.roles : [],
  });
}

/* ===== DELETE ===== */
export async function deletePersonById(id) {
  if (!id) return;

  const docRef = doc(db, "persons", id);
  await deleteDoc(docRef);
}
