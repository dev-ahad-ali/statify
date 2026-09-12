INSERT OR IGNORE INTO users (
  id,
  email,
  password_hash,
  name,
  created_at,
  updated_at
)
VALUES (
  'seed-user',
  'demo@statify.local',
  'local-seed-only',
  'Local Demo User',
  1704067200000,
  1704067200000
);

INSERT OR IGNORE INTO projects (
  id,
  owner_id,
  name,
  domain,
  api_key,
  allowed_domains,
  is_active,
  created_at,
  updated_at
)
VALUES (
  'seed-project',
  'seed-user',
  'Local Demo Project',
  'example.com',
  'orb_local_seed_key',
  '[]',
  1,
  1704067200000,
  1704067200000
);
