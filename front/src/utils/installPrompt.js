// Installability state for the PWA install button.
//
// The browser fires `beforeinstallprompt` once, when the app is installable and
// not installed, and the event can be used only once. The event is therefore
// kept in module state rather than in one component, so the footer button, a
// second footer on another page and the feature-guide catalog all agree.
//
// The listener is installed by the first subscriber (the footer button). A page
// without a footer never asks, so it never needs the state.

/**
 * Whether this page already runs as an installed app. `matchMedia` covers
 * Chromium and Android; `navigator.standalone` is the iOS Safari equivalent.
 */
export const isStandaloneApp = () => {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(display-mode: standalone)")?.matches) return true;
  } catch {
    // No matchMedia (older webviews): fall through to the iOS flag.
  }
  return Boolean(window.navigator?.standalone);
};

let pendingEvent = null;
let listening = false;
const listeners = new Set();

const emit = () => {
  for (const listener of listeners) listener();
};

const onBeforeInstall = (event) => {
  // Keep the browser's mini-infobar away; the footer button is the one entry
  // point.
  event.preventDefault?.();
  pendingEvent = event;
  emit();
};

const onInstalled = () => {
  pendingEvent = null;
  emit();
};

/** Subscribes to changes and installs the window listeners once. */
export const subscribeInstallPrompt = (listener) => {
  listeners.add(listener);
  if (!listening && typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    listening = true;
  }
  return () => {
    listeners.delete(listener);
  };
};

/** True while a stashed install prompt exists (the browser said "installable"). */
export const canInstallApp = () => Boolean(pendingEvent);

/**
 * Hands the stashed event to its single use and clears the state. Resolves to
 * the user's choice (`accepted`, `dismissed`) or `unavailable`.
 */
export const takeInstallPrompt = async () => {
  const event = pendingEvent;
  if (!event) return "unavailable";
  try {
    await event.prompt();
    const choice = await event.userChoice;
    return choice?.outcome ?? "dismissed";
  } finally {
    // The event cannot be reused, whatever the user answered.
    pendingEvent = null;
    emit();
  }
};
