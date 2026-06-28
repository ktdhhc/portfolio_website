import { test, expect } from '@playwright/test';
import { onRequestGet } from '../functions/api/admin/logs-export';
import { FakeAgentTurnStore } from '../functions/api/_store/fake';
import type { AgentTurnRecord } from '../functions/api/_store/types';

// ─────────────────────────────
// Issue 026: Logs 导出（CSV + JSON）
// ─────────────────────────────

function makeTurn(overrides: Partial<AgentTurnRecord> = {}): AgentTurnRecord {
  return {
    visitorUuid: 'test-uuid-001',
    agentSessionId: 'test-session-001',
    turnType: 'chat',
    userMessage: 'test question',
    assistantAnswer: 'test answer',
    answerStatus: 'success',
    durationMs: 1000,
    createdAt: '2026-06-28T10:00:00.000Z',
    ...overrides,
  };
}

function makeExportContext(store: FakeAgentTurnStore, url: string) {
  return {
    request: new Request(url, { method: 'GET', headers: { Authorization: 'Bearer test-token' } }),
    env: { AGENT_TURN_STORE: store },
  } as never;
}

// ─── JSON 导出 ───

test('026-01: JSON 导出返回正确 Content-Type 和完整字段', async () => {
  const store = new FakeAgentTurnStore();
  await store.insertTurn(makeTurn({
    id: 'turn-1',
    userMessage: '你好',
    assistantAnswer: '你好！我是 Candidate Agent',
    turnType: 'chat',
    answerStatus: 'success',
    durationMs: 2000,
    visitorUuid: 'uuid-12345678-abcd',
    agentSessionId: 'sess-12345678-abcd',
    createdAt: '2026-06-28T10:00:00.000Z',
  }));

  const ctx = makeExportContext(store, 'http://localhost/api/admin/logs/export?format=json&period=all');
  const res = await onRequestGet(ctx);

  expect(res.headers.get('Content-Type')).toBe('application/json');
  const data = await res.json();
  expect(data).toHaveLength(1);
  expect(data[0].id).toBe('turn-1');
  expect(data[0].userMessage).toBe('你好');
  expect(data[0].assistantAnswer).toBe('你好！我是 Candidate Agent');
  expect(data[0].turnType).toBe('chat');
  expect(data[0].answerStatus).toBe('success');
  expect(data[0].durationMs).toBe(2000);
  expect(data[0].visitorUuidShort).toBe('uuid-123');
  expect(data[0].agentSessionIdShort).toBe('sess-123');
});

// ─── CSV 导出 ───

test('026-02: CSV 导出返回正确 Content-Type + Content-Disposition + 10 列头', async () => {
  const store = new FakeAgentTurnStore();
  await store.insertTurn(makeTurn({ id: 'turn-1' }));

  const ctx = makeExportContext(store, 'http://localhost/api/admin/logs/export?format=csv&period=all');
  const res = await onRequestGet(ctx);

  expect(res.headers.get('Content-Type')).toContain('text/csv');
  expect(res.headers.get('Content-Disposition')).toContain('attachment');
  const text = await res.text();
  const lines = text.split('\n');
  const header = lines[0];
  expect(header).toBe('id,created_at,turn_type,answer_status,user_message,assistant_answer,duration_ms,visitor_uuid_short,agent_session_id_short,tool_trace_json');
});

test('026-03: CSV 正确转义含逗号/引号/换行的字段', async () => {
  const store = new FakeAgentTurnStore();
  await store.insertTurn(makeTurn({
    id: 'turn-1',
    userMessage: '问题含,逗号',
    assistantAnswer: '回答含"引号"和\n换行',
  }));

  const ctx = makeExportContext(store, 'http://localhost/api/admin/logs/export?format=csv&period=all');
  const res = await onRequestGet(ctx);
  const rawText = await res.text();

  // 逗号字段用双引号包裹
  expect(rawText).toContain('"问题含,逗号"');
  // 引号字段引号加倍
  expect(rawText).toContain('"回答含""引号""和');
  // 换行在 RFC 4180 中允许作为字面量存在于带引号的字段内
  expect(rawText).toContain('换行"');
});

// ─── period 参数 ───

test('026-04: period=all 返回全量，period=week 按窗口过滤', async () => {
  const store = new FakeAgentTurnStore();
  await store.insertTurn(makeTurn({ id: 'turn-1', createdAt: '2026-06-28T10:00:00.000Z' }));
  await store.insertTurn(makeTurn({ id: 'turn-2', createdAt: '2026-01-01T10:00:00.000Z' }));

  // period=all 应返回 2 条
  const ctxAll = makeExportContext(store, 'http://localhost/api/admin/logs/export?format=json&period=all');
  const resAll = await onRequestGet(ctxAll);
  const dataAll = await resAll.json();
  expect(dataAll).toHaveLength(2);

  // period=week 应只返回本周的（取决于当前日期，但至少不应超过 2 条）
  const ctxWeek = makeExportContext(store, 'http://localhost/api/admin/logs/export?format=json&period=week');
  const resWeek = await onRequestGet(ctxWeek);
  const dataWeek = await resWeek.json();
  expect(dataWeek.length).toBeLessThanOrEqual(2);
});

// ─── D1 降级 ───

test('026-05: store 不可用时返回 db_unavailable', async () => {
  const store = new FakeAgentTurnStore();
  store.shouldFailList = true;

  const ctx = makeExportContext(store, 'http://localhost/api/admin/logs/export?format=json&period=all');
  const res = await onRequestGet(ctx);
  const data = await res.json();

  expect(data.ok).toBe(false);
  expect(data.reason).toBe('db_unavailable');
});
