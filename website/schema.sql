CREATE TABLE IF NOT EXISTS feedback_entries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('feedback', 'waiting_list')),
  email TEXT,
  message TEXT,
  features_json TEXT,
  custom_feature TEXT,
  source TEXT,
  locale TEXT,
  page_url TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_entries_type_created
ON feedback_entries (type, created_at);

CREATE INDEX IF NOT EXISTS idx_feedback_entries_email
ON feedback_entries (email);

CREATE INDEX IF NOT EXISTS idx_feedback_entries_ip_created
ON feedback_entries (ip_hash, created_at);
