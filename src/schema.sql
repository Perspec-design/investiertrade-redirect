CREATE TABLE IF NOT EXISTS links (
  slug       TEXT PRIMARY KEY,
  target_url TEXT NOT NULL,
  clicks     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

