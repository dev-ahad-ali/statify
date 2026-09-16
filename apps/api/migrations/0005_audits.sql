CREATE TABLE audits (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  url TEXT NOT NULL,
  ran_at INTEGER NOT NULL,
  performance INTEGER,
  accessibility INTEGER,
  best_practices INTEGER,
  seo INTEGER,
  agentic INTEGER,
  lcp_ms INTEGER,
  inp_ms INTEGER,
  cls REAL,
  raw_json TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_audits_project_ran_at
  ON audits(project_id, ran_at);
