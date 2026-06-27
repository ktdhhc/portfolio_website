import { test, expect } from '@playwright/test';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { createD1Stores } from '../functions/api/_store/d1';

function makeDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE behavior_events (
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
    CREATE TABLE agent_turns (
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
    CREATE TABLE rate_limit_counters (
      visitor_uuid TEXT NOT NULL,
      hour_bucket TEXT NOT NULL,
      uuid_count INTEGER NOT NULL DEFAULT 0,
      date_bucket TEXT NOT NULL,
      PRIMARY KEY (visitor_uuid, hour_bucket)
    );
  `);
  return db;
}

// 包装成 D1Database 兼容接口
function wrapAsD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      return {
        bind(...params: SQLInputValue[]) {
          return {
            async run() {
              db.exec('BEGIN');
              try {
                const stmt = db.prepare(sql);
                stmt.run(...params);
                db.exec('COMMIT');
                return { success: true };
              } catch (e) {
                db.exec('ROLLBACK');
                throw e;
              }
            },
            async all() {
              const stmt = db.prepare(sql);
              const rows = stmt.all(...params) as Record<string, unknown>[];
              return { results: rows };
            },
            async first() {
              const stmt = db.prepare(sql);
              return stmt.get(...params) ?? null;
            },
          };
        },
      };
    },
  };
}

// ─────────────────────────────
// D1 Store 实现
// ─────────────────────────────

test('d1-01: D1 behavior_events 入库', async () => {
  const db = wrapAsD1(makeDb());
  const stores = createD1Stores(db as never);
  await stores.behaviorEventStore.insertEvents([
    {
      visitorUuid: 'd1-uuid-1',
      eventType: 'page_view',
      path: '/',
      createdAt: new Date().toISOString(),
    },
  ]);
  const row = await db.prepare('SELECT * FROM behavior_events WHERE visitor_uuid = ?').bind('d1-uuid-1').first() as Record<string, unknown>;
  expect(row).not.toBeNull();
  expect(row.event_type).toBe('page_view');
  expect(row.path).toBe('/');
});

test('d1-02: D1 agent_turns 入库', async () => {
  const db = wrapAsD1(makeDb());
  const stores = createD1Stores(db as never);
  await stores.agentTurnStore.insertTurn({
    visitorUuid: 'd1-uuid-2',
    agentSessionId: 'd1-session-2',
    turnType: 'chat',
    userMessage: '你好',
    assistantAnswer: '回答',
    answerStatus: 'success',
    durationMs: 100,
    createdAt: new Date().toISOString(),
  });
  const row = await db.prepare('SELECT * FROM agent_turns WHERE visitor_uuid = ?').bind('d1-uuid-2').first() as Record<string, unknown>;
  expect(row).not.toBeNull();
  expect(row.turn_type).toBe('chat');
  expect(row.user_message).toBe('你好');
  expect(row.assistant_answer).toBe('回答');
});

test('d1-03: D1 限频 checkAndIncrement 首次放行', async () => {
  const db = wrapAsD1(makeDb());
  const stores = createD1Stores(db as never);
  const result = await stores.rateLimitStore.checkAndIncrement('d1-uuid-3');
  expect(result.allowed).toBe(true);
});

test('d1-04: D1 限频超过阈值后拒绝', async () => {
  const db = wrapAsD1(makeDb());
  const stores = createD1Stores(db as never);
  stores.rateLimitStore.setUuidLimit(1);
  await stores.rateLimitStore.checkAndIncrement('d1-uuid-4');
  const result = await stores.rateLimitStore.checkAndIncrement('d1-uuid-4');
  expect(result.allowed).toBe(false);
  expect(result.reason).toBe('uuid_limit');
});

test('d1-05: D1 限频全局阈值拒绝', async () => {
  const db = wrapAsD1(makeDb());
  const stores = createD1Stores(db as never);
  stores.rateLimitStore.setGlobalLimit(1);
  await stores.rateLimitStore.checkAndIncrement('d1-uuid-5a');
  const result = await stores.rateLimitStore.checkAndIncrement('d1-uuid-5b');
  expect(result.allowed).toBe(false);
  expect(result.reason).toBe('global_limit');
});
