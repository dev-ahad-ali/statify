CREATE TABLE projects (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  allowed_domains TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(allowed_domains)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (owner_id, domain),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_projects_api_key ON projects(api_key);
CREATE INDEX idx_projects_owner_id ON projects(owner_id);
