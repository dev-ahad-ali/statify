export async function deleteExpiredEvents(db: D1Database, now = Date.now()) {
  const cutoff = now - 90 * 24 * 60 * 60 * 1000;
  return db.prepare("DELETE FROM events WHERE timestamp < ?").bind(cutoff).run();
}
