import { ROLLUP_COLUMNS, ROLLUP_TABLES, type EventType } from "@statify/shared";

export type IngestContext = {
  userAgent: string;
  language: string;
  screen: string;
  hostname: string;
  browser: string;
  os: string;
  device: string;
  country: string;
  region: string;
  city: string;
  timezone: string;
};

export type QueuedEvent = {
  id: string;
  type: EventType;
  visitorId: string;
  sessionId: string;
  timestamp: number;
  receivedAt: number;
  path: string | null;
  query: string | null;
  title: string | null;
  referrer: string | null;
  tagName: string | null;
  elementId: string | null;
  className: string | null;
  text: string | null;
  href: string | null;
  userAgent: string;
  browser: string;
  os: string;
  device: string;
  language: string;
  screen: string;
  hostname: string;
  country: string;
  region: string;
  city: string;
  timezone: string;
  agentCategory: string | null;
  agentVendor: string | null;
  agentHarness: string | null;
  agentConfidence: string | null;
  source: "browser" | "server";
  vitalName: string | null;
  vitalValue: number | null;
  vitalRating: string | null;
};

function sqlValue(value: string | null) {
  return value ?? "unknown";
}

function dateFor(event: QueuedEvent) {
  const drift = Math.abs(event.receivedAt - event.timestamp);
  const timestamp = drift > 24 * 60 * 60 * 1000 ? event.receivedAt : event.timestamp;
  return new Date(timestamp).toISOString().slice(0, 10);
}

function eventStatement(db: D1Database, projectId: string, event: QueuedEvent) {
  return db
    .prepare(
      `INSERT INTO events (
        id, project_id, visitor_id, session_id, type, timestamp, received_at,
        path, query, title, referrer, tag_name, element_id, class_name, text, href,
        user_agent, browser, os, device, language, screen, hostname,
        country, region, city, timezone, agent_category, agent_vendor, agent_harness,
        agent_confidence, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
    )
    .bind(
      event.id, projectId, event.visitorId, event.sessionId, event.type, event.timestamp, event.receivedAt,
      event.path, event.query, event.title, event.referrer, event.tagName, event.elementId, event.className, event.text, event.href,
      event.userAgent, event.browser, event.os, event.device, event.language, event.screen, event.hostname,
      event.country, event.region, event.city, event.timezone, event.agentCategory, event.agentVendor,
      event.agentHarness, event.agentConfidence, event.source,
    );
}

function upsert(statement: string, db: D1Database, values: unknown[]) {
  return db.prepare(statement).bind(...values);
}

function pageViewRollups(db: D1Database, projectId: string, event: QueuedEvent): D1PreparedStatement[] {
  const date = dateFor(event);
  const path = sqlValue(event.path);
  const referrer = sqlValue(event.referrer);
  const country = sqlValue(event.country);
  const region = sqlValue(event.region);
  const city = sqlValue(event.city);
  const browser = sqlValue(event.browser);
  const os = sqlValue(event.os);
  const device = sqlValue(event.device);
  const entries = event.referrer ? 0 : 1;
  const stats = ROLLUP_TABLES.stats;
  const statsColumns = ROLLUP_COLUMNS.stats;
  const statements: D1PreparedStatement[] = [
    upsert(
      `INSERT INTO ${stats} (${statsColumns.projectId}, ${statsColumns.date}, ${statsColumns.pageviews}, ${statsColumns.entries}, ${statsColumns.visitors}, ${statsColumns.sessions}) VALUES (?, ?, 1, ?, 0, 0) ON CONFLICT (${statsColumns.projectId}, ${statsColumns.date}) DO UPDATE SET ${statsColumns.pageviews} = ${statsColumns.pageviews} + 1, ${statsColumns.entries} = ${statsColumns.entries} + ?`,
      db, [projectId, date, entries, entries],
    ),
    upsert(`INSERT OR IGNORE INTO ${ROLLUP_TABLES.visitors} (${ROLLUP_COLUMNS.visitors.projectId}, ${ROLLUP_COLUMNS.visitors.date}, ${ROLLUP_COLUMNS.visitors.visitorId}, ${ROLLUP_COLUMNS.visitors.firstSeenAt}) VALUES (?, ?, ?, ?)`, db, [projectId, date, event.visitorId, event.timestamp]),
    upsert(`UPDATE ${stats} SET ${statsColumns.visitors} = ${statsColumns.visitors} + changes() WHERE ${statsColumns.projectId} = ? AND ${statsColumns.date} = ?`, db, [projectId, date]),
    upsert(`INSERT OR IGNORE INTO ${ROLLUP_TABLES.sessions} (${ROLLUP_COLUMNS.sessions.projectId}, ${ROLLUP_COLUMNS.sessions.date}, ${ROLLUP_COLUMNS.sessions.sessionId}, ${ROLLUP_COLUMNS.sessions.firstSeenAt}) VALUES (?, ?, ?, ?)`, db, [projectId, date, event.sessionId, event.timestamp]),
    upsert(`UPDATE ${stats} SET ${statsColumns.sessions} = ${statsColumns.sessions} + changes() WHERE ${statsColumns.projectId} = ? AND ${statsColumns.date} = ?`, db, [projectId, date]),
    upsert(`INSERT INTO ${ROLLUP_TABLES.pages} (${ROLLUP_COLUMNS.pages.projectId}, ${ROLLUP_COLUMNS.pages.date}, ${ROLLUP_COLUMNS.pages.path}, ${ROLLUP_COLUMNS.pages.pageviews}, ${ROLLUP_COLUMNS.pages.entries}) VALUES (?, ?, ?, 1, ?) ON CONFLICT (${ROLLUP_COLUMNS.pages.projectId}, ${ROLLUP_COLUMNS.pages.date}, ${ROLLUP_COLUMNS.pages.path}) DO UPDATE SET ${ROLLUP_COLUMNS.pages.pageviews} = ${ROLLUP_COLUMNS.pages.pageviews} + 1, ${ROLLUP_COLUMNS.pages.entries} = ${ROLLUP_COLUMNS.pages.entries} + ?`, db, [projectId, date, path, entries, entries]),
    upsert(`INSERT INTO ${ROLLUP_TABLES.referrers} (${ROLLUP_COLUMNS.referrers.projectId}, ${ROLLUP_COLUMNS.referrers.date}, ${ROLLUP_COLUMNS.referrers.referrer}, ${ROLLUP_COLUMNS.referrers.pageviews}) VALUES (?, ?, ?, 1) ON CONFLICT (${ROLLUP_COLUMNS.referrers.projectId}, ${ROLLUP_COLUMNS.referrers.date}, ${ROLLUP_COLUMNS.referrers.referrer}) DO UPDATE SET ${ROLLUP_COLUMNS.referrers.pageviews} = ${ROLLUP_COLUMNS.referrers.pageviews} + 1`, db, [projectId, date, referrer]),
    upsert(`INSERT INTO ${ROLLUP_TABLES.countries} (${ROLLUP_COLUMNS.countries.projectId}, ${ROLLUP_COLUMNS.countries.date}, ${ROLLUP_COLUMNS.countries.countryCode}, ${ROLLUP_COLUMNS.countries.visitors}) VALUES (?, ?, ?, 1) ON CONFLICT (${ROLLUP_COLUMNS.countries.projectId}, ${ROLLUP_COLUMNS.countries.date}, ${ROLLUP_COLUMNS.countries.countryCode}) DO UPDATE SET ${ROLLUP_COLUMNS.countries.visitors} = ${ROLLUP_COLUMNS.countries.visitors} + 1`, db, [projectId, date, country]),
    upsert(`INSERT INTO ${ROLLUP_TABLES.regions} (${ROLLUP_COLUMNS.regions.projectId}, ${ROLLUP_COLUMNS.regions.date}, ${ROLLUP_COLUMNS.regions.countryCode}, ${ROLLUP_COLUMNS.regions.region}, ${ROLLUP_COLUMNS.regions.visitors}) VALUES (?, ?, ?, ?, 1) ON CONFLICT (${ROLLUP_COLUMNS.regions.projectId}, ${ROLLUP_COLUMNS.regions.date}, ${ROLLUP_COLUMNS.regions.countryCode}, ${ROLLUP_COLUMNS.regions.region}) DO UPDATE SET ${ROLLUP_COLUMNS.regions.visitors} = ${ROLLUP_COLUMNS.regions.visitors} + 1`, db, [projectId, date, country, region]),
    upsert(`INSERT INTO ${ROLLUP_TABLES.cities} (${ROLLUP_COLUMNS.cities.projectId}, ${ROLLUP_COLUMNS.cities.date}, ${ROLLUP_COLUMNS.cities.countryCode}, ${ROLLUP_COLUMNS.cities.region}, ${ROLLUP_COLUMNS.cities.city}, ${ROLLUP_COLUMNS.cities.visitors}) VALUES (?, ?, ?, ?, ?, 1) ON CONFLICT (${ROLLUP_COLUMNS.cities.projectId}, ${ROLLUP_COLUMNS.cities.date}, ${ROLLUP_COLUMNS.cities.countryCode}, ${ROLLUP_COLUMNS.cities.region}, ${ROLLUP_COLUMNS.cities.city}) DO UPDATE SET ${ROLLUP_COLUMNS.cities.visitors} = ${ROLLUP_COLUMNS.cities.visitors} + 1`, db, [projectId, date, country, region, city]),
    upsert(`INSERT INTO ${ROLLUP_TABLES.browsers} (${ROLLUP_COLUMNS.browsers.projectId}, ${ROLLUP_COLUMNS.browsers.date}, ${ROLLUP_COLUMNS.browsers.browser}, ${ROLLUP_COLUMNS.browsers.visitors}) VALUES (?, ?, ?, 1) ON CONFLICT (${ROLLUP_COLUMNS.browsers.projectId}, ${ROLLUP_COLUMNS.browsers.date}, ${ROLLUP_COLUMNS.browsers.browser}) DO UPDATE SET ${ROLLUP_COLUMNS.browsers.visitors} = ${ROLLUP_COLUMNS.browsers.visitors} + 1`, db, [projectId, date, browser]),
    upsert(`INSERT INTO ${ROLLUP_TABLES.os} (${ROLLUP_COLUMNS.os.projectId}, ${ROLLUP_COLUMNS.os.date}, ${ROLLUP_COLUMNS.os.os}, ${ROLLUP_COLUMNS.os.visitors}) VALUES (?, ?, ?, 1) ON CONFLICT (${ROLLUP_COLUMNS.os.projectId}, ${ROLLUP_COLUMNS.os.date}, ${ROLLUP_COLUMNS.os.os}) DO UPDATE SET ${ROLLUP_COLUMNS.os.visitors} = ${ROLLUP_COLUMNS.os.visitors} + 1`, db, [projectId, date, os]),
    upsert(`INSERT INTO ${ROLLUP_TABLES.devices} (${ROLLUP_COLUMNS.devices.projectId}, ${ROLLUP_COLUMNS.devices.date}, ${ROLLUP_COLUMNS.devices.device}, ${ROLLUP_COLUMNS.devices.visitors}) VALUES (?, ?, ?, 1) ON CONFLICT (${ROLLUP_COLUMNS.devices.projectId}, ${ROLLUP_COLUMNS.devices.date}, ${ROLLUP_COLUMNS.devices.device}) DO UPDATE SET ${ROLLUP_COLUMNS.devices.visitors} = ${ROLLUP_COLUMNS.devices.visitors} + 1`, db, [projectId, date, device]),
  ];

  return statements;
}

function agentRollup(db: D1Database, projectId: string, event: QueuedEvent): D1PreparedStatement[] {
  if (!event.agentCategory) return [];
  const date = dateFor(event);
  return [upsert(`INSERT INTO ${ROLLUP_TABLES.agents} (${ROLLUP_COLUMNS.agents.projectId}, ${ROLLUP_COLUMNS.agents.date}, ${ROLLUP_COLUMNS.agents.category}, ${ROLLUP_COLUMNS.agents.vendor}, ${ROLLUP_COLUMNS.agents.harness}, ${ROLLUP_COLUMNS.agents.confidence}, ${ROLLUP_COLUMNS.agents.visitors}) VALUES (?, ?, ?, ?, ?, ?, 1) ON CONFLICT (${ROLLUP_COLUMNS.agents.projectId}, ${ROLLUP_COLUMNS.agents.date}, ${ROLLUP_COLUMNS.agents.category}, ${ROLLUP_COLUMNS.agents.vendor}, ${ROLLUP_COLUMNS.agents.harness}, ${ROLLUP_COLUMNS.agents.confidence}) DO UPDATE SET ${ROLLUP_COLUMNS.agents.visitors} = ${ROLLUP_COLUMNS.agents.visitors} + 1`, db, [projectId, date, event.agentCategory, sqlValue(event.agentVendor), sqlValue(event.agentHarness), sqlValue(event.agentConfidence)])];
}

function vitalRollup(db: D1Database, projectId: string, event: QueuedEvent): D1PreparedStatement[] {
  if (!event.vitalName || event.vitalValue === null || !["LCP", "INP", "CLS"].includes(event.vitalName)) return [];
  const date = dateFor(event);
  return [upsert(
    "INSERT INTO daily_vitals (project_id, date, name, count, total, p75_sample) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT (project_id, date, name) DO UPDATE SET count = count + 1, total = total + ?, p75_sample = ?",
    db,
    [projectId, date, event.vitalName, event.vitalValue, JSON.stringify([event.vitalValue]), event.vitalValue, JSON.stringify([event.vitalValue])],
  )];
}

export async function writeEventBatch(db: D1Database, projectId: string, events: QueuedEvent[]) {
  const statements = events.flatMap((event) => [eventStatement(db, projectId, event), ...(event.type === "page_view" ? pageViewRollups(db, projectId, event) : []), ...agentRollup(db, projectId, event), ...vitalRollup(db, projectId, event)]);
  await db.batch(statements);
}
