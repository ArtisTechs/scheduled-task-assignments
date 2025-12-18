const TOAST_EVENT = "app:toast";

export function showToast(message = "Success") {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));
}

export function listenToast(handler) {
  window.addEventListener(TOAST_EVENT, handler);
}

export function removeToastListener(handler) {
  window.removeEventListener(TOAST_EVENT, handler);
}
