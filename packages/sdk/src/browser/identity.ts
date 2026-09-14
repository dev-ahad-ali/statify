const VISITOR_KEY = "sf_vid";
const SESSION_KEY = "sf_sid";
const SESSION_ACTIVITY_KEY = "sf_sid_last_seen";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function createId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function visitorId() {
  const existing = localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;
  const id = createId();
  localStorage.setItem(VISITOR_KEY, id);
  return id;
}

export function sessionId() {
  const now = Date.now();
  const existing = sessionStorage.getItem(SESSION_KEY);
  const lastSeen = Number(sessionStorage.getItem(SESSION_ACTIVITY_KEY));
  if (!existing || !Number.isFinite(lastSeen) || now - lastSeen > SESSION_TIMEOUT_MS) {
    const id = createId();
    sessionStorage.setItem(SESSION_KEY, id);
    sessionStorage.setItem(SESSION_ACTIVITY_KEY, String(now));
    return id;
  }
  sessionStorage.setItem(SESSION_ACTIVITY_KEY, String(now));
  return existing;
}
