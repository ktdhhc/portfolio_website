import { onRequestPost as track } from '../functions/api/track';
import { onRequestPost as chat } from '../functions/api/chat';
import { FakeBehaviorEventStore, FakeAgentTurnStore, FakeRateLimitStore } from '../functions/api/_store/fake';
import { createD1Stores } from '../functions/api/_store/d1';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ok: ${message}`);
    passed += 1;
  } else {
    console.error(`  FAIL: ${message}`);
    failed += 1;
  }
}

function makeSqliteDb(): DatabaseSync {
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

function wrapAsD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      return {
        bind(...params: SQLInputValue[]) {
          return {
            async run() {
              const stmt = db.prepare(sql);
              stmt.run(...params);
              return { success: true };
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

async function run() {
  console.log('Stage 3 data layer smoke test\n');

  // ── Fake store 层 ──
  console.log('1. fake: behavior_events 入库');
  {
    const store = new FakeBehaviorEventStore();
    const res = await track({
      request: new Request('http://localhost/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorUuid: 'smoke-uuid-1',
          events: [{ type: 'page_view', path: '/' }],
        }),
      }),
      env: { BEHAVIOR_EVENT_STORE: store },
    } as never);
    assert(res.status === 200, 'track 返回 200');
    assert(store.records.length === 1, 'behavior_events 入库 1 条');
    assert(store.records[0].eventType === 'page_view', '事件类型为 page_view');
  }

  console.log('2. fake: agent_turns 入库');
  {
    const turnStore = new FakeAgentTurnStore();
    const rateLimit = new FakeRateLimitStore();
    const res = await chat({
      request: new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorUuid: 'smoke-uuid-2',
          agentSessionId: 'smoke-session-2',
          messages: [{ role: 'user', content: '你好' }],
        }),
      }),
      env: { ACTIVE_PROVIDER: 'test', AGENT_TURN_STORE: turnStore, RATE_LIMIT_STORE: rateLimit },
    } as never);
    await res.text();
    assert(res.status === 200, 'chat 返回 200');
    assert(turnStore.records.length === 1, 'agent_turns 入库 1 条');
    assert(turnStore.records[0].turnType === 'chat', 'turnType 为 chat');
  }

  console.log('3. fake: 限频读写');
  {
    const rateLimit = new FakeRateLimitStore();
    const res = await chat({
      request: new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorUuid: 'smoke-uuid-3',
          agentSessionId: 'smoke-session-3',
          messages: [{ role: 'user', content: '你好' }],
        }),
      }),
      env: { ACTIVE_PROVIDER: 'test', RATE_LIMIT_STORE: rateLimit },
    } as never);
    await res.text();
    assert(res.status === 200, 'chat 返回 200');
    assert(rateLimit.uuidCounts.get('smoke-uuid-3') === 1, 'UUID 计数 +1');
    assert(rateLimit.globalCount === 1, '全局计数 +1');
  }

  console.log('4. fake: D1 退化');
  {
    const failingTurnStore = {
      async insertTurn() { throw new Error('D1 unavailable'); },
    };
    const failingRateLimit = {
      async checkAndIncrement() { throw new Error('D1 unavailable'); },
    };
    const res = await chat({
      request: new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorUuid: 'smoke-uuid-4',
          agentSessionId: 'smoke-session-4',
          messages: [{ role: 'user', content: '你好' }],
        }),
      }),
      env: { ACTIVE_PROVIDER: 'test', AGENT_TURN_STORE: failingTurnStore, RATE_LIMIT_STORE: failingRateLimit },
    } as never);
    const body = await res.text();
    assert(res.status === 200, 'D1 失败时 chat 仍返回 200');
    assert(body.includes('Candidate Agent'), 'D1 失败时 SSE 回答仍正常');
  }

  // ── D1 store 层（真实 SQLite）──
  console.log('5. D1: behavior_events 入库');
  {
    const db = wrapAsD1(makeSqliteDb());
    const stores = createD1Stores(db as never);
    await stores.behaviorEventStore.insertEvents([
      { visitorUuid: 'd1-smoke-1', eventType: 'page_view', path: '/', createdAt: new Date().toISOString() },
    ]);
    const row = await db.prepare('SELECT * FROM behavior_events WHERE visitor_uuid = ?').bind('d1-smoke-1').first() as Record<string, unknown>;
    assert(row !== null, 'D1 behavior_events 入库成功');
    assert(row.event_type === 'page_view', 'D1 event_type 正确');
  }

  console.log('6. D1: agent_turns 入库');
  {
    const db = wrapAsD1(makeSqliteDb());
    const stores = createD1Stores(db as never);
    await stores.agentTurnStore.insertTurn({
      visitorUuid: 'd1-smoke-2',
      agentSessionId: 'd1-session-2',
      turnType: 'chat',
      userMessage: '你好',
      assistantAnswer: '回答',
      answerStatus: 'success',
      durationMs: 100,
      createdAt: new Date().toISOString(),
    });
    const row = await db.prepare('SELECT * FROM agent_turns WHERE visitor_uuid = ?').bind('d1-smoke-2').first() as Record<string, unknown>;
    assert(row !== null, 'D1 agent_turns 入库成功');
    assert(row.user_message === '你好', 'D1 user_message 正确');
  }

  console.log('7. D1: 限频读写');
  {
    const db = wrapAsD1(makeSqliteDb());
    const stores = createD1Stores(db as never);
    const r1 = await stores.rateLimitStore.checkAndIncrement('d1-smoke-3');
    assert(r1.allowed === true, 'D1 首次限频放行');
    const r2 = await stores.rateLimitStore.checkAndIncrement('d1-smoke-3');
    assert(r2.allowed === true, 'D1 第二次限频放行');
    const row = await db.prepare('SELECT uuid_count FROM rate_limit_counters WHERE visitor_uuid = ?').bind('d1-smoke-3').first() as Record<string, unknown>;
    assert(row.uuid_count === 2, 'D1 限频计数正确');
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
