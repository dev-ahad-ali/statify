CREATE TABLE daily_vitals (
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,
  name TEXT NOT NULL CHECK (name IN ('LCP', 'INP', 'CLS')),
  count INTEGER NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  p75_sample TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (project_id, date, name),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_daily_vitals_project_date
  ON daily_vitals(project_id, date);
