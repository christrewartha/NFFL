// Persistence. Kept behind this tiny interface so a mobile build can swap
// localStorage for AsyncStorage / Capacitor Preferences without touching the UI.

const PREFIX = 'nffl:v1:';

export function load(key, storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function save(key, value, storage = globalThis.localStorage) {
  try {
    if (value == null) storage?.removeItem(PREFIX + key);
    else storage?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable (e.g. private browsing) - the app still works in memory.
  }
}
