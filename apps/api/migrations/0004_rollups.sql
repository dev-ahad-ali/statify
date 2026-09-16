CREATE TABLE daily_stats (
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,
  pageviews INTEGER NOT NULL DEFAULT 0,
  entries INTEGER NOT NULL DEFAULT 0,
  visitors INTEGER NOT NULL DEFAULT 0,
  sessions INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, date),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE daily_pages (
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,
  path TEXT NOT NULL,
  pageviews INTEGER NOT NULL DEFAULT 0,
  entries INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, date, path),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE daily_referrers (
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,
  referrer TEXT NOT NULL,
  pageviews INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, date, referrer),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE daily_countries (
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,
  country_code TEXT NOT NULL,
  visitors INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, date, country_code),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE daily_regions (
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,
  country_code TEXT NOT NULL,
  region TEXT NOT NULL,
  visitors INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, date, country_code, region),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE daily_cities (
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,
  country_code TEXT NOT NULL,
  region TEXT NOT NULL,
  city TEXT NOT NULL,
  visitors INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, date, country_code, region, city),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE daily_browsers (
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,
  browser TEXT NOT NULL,
  visitors INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, date, browser),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE daily_os (
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,
  os TEXT NOT NULL,
  visitors INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, date, os),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE daily_devices (
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,
  device TEXT NOT NULL,
  visitors INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, date, device),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE daily_agents (
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  vendor TEXT NOT NULL,
  harness TEXT NOT NULL,
  confidence TEXT NOT NULL,
  visitors INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, date, category, vendor, harness, confidence),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE daily_visitors (
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, date, visitor_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE daily_sessions (
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,
  session_id TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, date, session_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
