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
    CREATE TABLE admin_login_failures (
      ip TEXT PRIMARY KEY,
      failure_count INTEGER NOT NULL DEFAULT 0,
      cooldown_until_ms INTEGER,
      updated_at TEXT NOT NULL
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

async function withMockedNow<T>(iso: string, fn: () => Promise<T>): Promise<T> {
  const RealDate = Date;
  const fixed = new RealDate(iso);
  class MockDate extends RealDate {
    constructor(value?: string | number | Date) {
      super(value ?? fixed.toISOString());
    }
    static override now(): number {
      return fixed.getTime();
    }
  }
  // @ts-expect-error test-only Date override
  globalThis.Date = MockDate;
  try {
    return await fn();
  } finally {
    globalThis.Date = RealDate;
  }
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

test('d1-06: D1 限频分桶使用人类可读月份（6月不是5月）', async () => {
  await withMockedNow('2026-06-27T04:00:00.000Z', async () => {
    const db = wrapAsD1(makeDb());
    const stores = createD1Stores(db as never);
    await stores.rateLimitStore.checkAndIncrement('d1-uuid-6');
    const row = await db.prepare('SELECT hour_bucket, date_bucket FROM rate_limit_counters WHERE visitor_uuid = ?').bind('d1-uuid-6').first() as Record<string, unknown>;
    expect(String(row.hour_bucket).startsWith('2026-6-')).toBe(true);
    expect(String(row.date_bucket).startsWith('2026-6-')).toBe(true);
  });
});

test('d1-07: D1 admin 登录失败超过阈值后拒绝', async () => {
  const db = wrapAsD1(makeDb());
  const stores = createD1Stores(db as never);
  stores.rateLimitStore.setAdminFailureLimit(2);

  let result = await stores.rateLimitStore.recordAdminLoginFailure('203.0.113.20');
  expect(result.allowed).toBe(true);

  result = await stores.rateLimitStore.recordAdminLoginFailure('203.0.113.20');
  expect(result.allowed).toBe(false);
  expect(result.reason).toBe('admin_rate_limit');
});

test('d1-08: D1 admin 登录冷却期后恢复', async () => {
  const db = wrapAsD1(makeDb());
  const stores = createD1Stores(db as never);
  stores.rateLimitStore.setAdminFailureLimit(1);
  stores.rateLimitStore.setAdminCooldownMs(60_000);

  await withMockedNow('2026-06-27T04:00:00.000Z', async () => {
    const result = await stores.rateLimitStore.recordAdminLoginFailure('203.0.113.21');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('admin_rate_limit');
  });

  await withMockedNow('2026-06-27T04:01:01.000Z', async () => {
    const result = await stores.rateLimitStore.checkAdminLoginRateLimit('203.0.113.21');
    expect(result.allowed).toBe(true);
  });
});

test('d1-09: D1 agent_turns 支持分页 logs 与按 id 读取详情', async () => {
  const db = wrapAsD1(makeDb());
  const stores = createD1Stores(db as never);
  await stores.agentTurnStore.insertTurn({
    visitorUuid: 'uuid-1',
    agentSessionId: 'session-1',
    turnType: 'chat',
    userMessage: '第一条',
    assistantAnswer: '回答-1',
    answerStatus: 'success',
    durationMs: 101,
    createdAt: '2026-06-28T10:00:00.000Z',
  });
  await stores.agentTurnStore.insertTurn({
    visitorUuid: 'uuid-2',
    agentSessionId: 'session-2',
    turnType: 'jd_analysis',
    userMessage: '第二条',
    assistantAnswer: '回答-2',
    answerStatus: 'degraded',
    durationMs: 202,
    toolTrace: { toolCalls: 1, files: ['resume.json'] },
    createdAt: '2026-06-28T11:00:00.000Z',
  });

  const page = await stores.agentTurnStore.listLogs(
    { startInclusive: '2026-06-28T09:00:00.000Z', endExclusive: '2026-06-28T12:00:00.000Z' },
    1,
    1,
  );
  expect(page.total).toBe(2);
  expect(page.totalPages).toBe(2);
  expect(page.items[0]?.id).toBe('2');
  expect(page.items[0]?.userMessage).toBe('第二条');

  const detail = await stores.agentTurnStore.getLogDetail('2', {
    startInclusive: '2026-06-28T09:00:00.000Z',
    endExclusive: '2026-06-28T12:00:00.000Z',
  });
  expect(detail?.assistantAnswer).toBe('回答-2');
  expect(detail?.toolTrace).toEqual({ toolCalls: 1, files: ['resume.json'] });
});
