-- 阶段 3 数据采集与对话记录
-- 对应 PRD: docs/prd/stage-3-data-collection-and-conversation-records.md
-- 表结构遵循 functions/api/_store/types.ts 的领域模型

-- 通用行为事件表
CREATE TABLE IF NOT EXISTS behavior_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_uuid TEXT NOT NULL,
  agent_session_id TEXT,
  event_type TEXT NOT NULL,
  path TEXT,
  target_kind TEXT,
  target_id TEXT,
  duration_ms INTEGER,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_behavior_events_created_at ON behavior_events(created_at);
CREATE INDEX IF NOT EXISTS idx_behavior_events_event_type ON behavior_events(event_type);
CREATE INDEX IF NOT EXISTS idx_behavior_events_visitor_uuid ON behavior_events(visitor_uuid);

-- Agent 问答轮次记录表
CREATE TABLE IF NOT EXISTS agent_turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_uuid TEXT NOT NULL,
  agent_session_id TEXT NOT NULL,
  turn_type TEXT NOT NULL,
  user_message TEXT NOT NULL,
  assistant_answer TEXT NOT NULL,
  answer_status TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  tool_trace_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_turns_created_at ON agent_turns(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_turns_turn_type ON agent_turns(turn_type);
CREATE INDEX IF NOT EXISTS idx_agent_turns_visitor_uuid ON agent_turns(visitor_uuid);
CREATE INDEX IF NOT EXISTS idx_agent_turns_agent_session_id ON agent_turns(agent_session_id);

-- 限频计数器表
-- 按 visitor_uuid + hour_bucket 做唯一键
-- date_bucket 用于全局按天聚合
CREATE TABLE IF NOT EXISTS rate_limit_counters (
  visitor_uuid TEXT NOT NULL,
  hour_bucket TEXT NOT NULL,
  uuid_count INTEGER NOT NULL DEFAULT 0,
  date_bucket TEXT NOT NULL,
  PRIMARY KEY (visitor_uuid, hour_bucket)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_date_bucket ON rate_limit_counters(date_bucket);
