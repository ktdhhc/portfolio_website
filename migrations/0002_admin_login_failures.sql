-- 阶段 4 admin 认证失败限频

CREATE TABLE IF NOT EXISTS admin_login_failures (
  ip TEXT PRIMARY KEY,
  failure_count INTEGER NOT NULL DEFAULT 0,
  cooldown_until_ms INTEGER,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_login_failures_updated_at
ON admin_login_failures(updated_at);
