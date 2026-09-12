CREATE TABLE events (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  received_at INTEGER NOT NULL,

  path TEXT,
  query TEXT,
  title TEXT,
  referrer TEXT,

  tag_name TEXT,
  element_id TEXT,
  class_name TEXT,
  text TEXT,
  href TEXT,

  user_agent TEXT,
  browser TEXT,
  os TEXT,
  device TEXT,
  language TEXT,
  screen TEXT,
  hostname TEXT,

  country TEXT,
  region TEXT,
  city TEXT,
  timezone TEXT,

  agent_category TEXT,
  agent_vendor TEXT,
  agent_harness TEXT,
  agent_confidence TEXT,
  source TEXT NOT NULL DEFAULT 'browser' CHECK (source IN ('browser', 'server')),

  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_events_project_timestamp
  ON events(project_id, timestamp);

CREATE INDEX idx_events_project_type
  ON events(project_id, type);

CREATE INDEX idx_events_visitor_id ON events(visitor_id);
CREATE INDEX idx_events_session_id ON events(session_id);
