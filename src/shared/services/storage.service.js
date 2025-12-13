const KEY = "persons";

export function loadPersons() {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export function savePersons(persons) {
  localStorage.setItem(KEY, JSON.stringify(persons));
}
