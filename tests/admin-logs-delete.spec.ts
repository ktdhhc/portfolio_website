import { test, expect } from '@playwright/test';
import { onRequestGet, onRequestDelete } from '../functions/api/admin/logs';
import { FakeAgentTurnStore } from '../functions/api/_store/fake';
import type { AgentTurnRecord } from '../functions/api/_store/types';
import { StoreUnavailableError } from '../functions/api/_store/errors';

// ─────────────────────────────
// Issue 025: Logs 删除（单条/范围/全清）
// ─────────────────────────────

// 参考 admin-logs.spec.ts 的测试模式：直接调用 handler + mock context

function makeContext(store: FakeAgentTurnStore, url = 'http://localhost/api/admin/logs') {
  return {
    request: new Request(url, { method: 'GET', headers: { Authorization: 'Bearer test-token' } }),
    env: { AGENT_TURN_STORE: store },
  } as never;
}

function makeDeleteContext(store: FakeAgentTurnStore, url: string) {
  return {
    request: new Request(url, { method: 'DELETE', headers: { Authorization: 'Bearer test-token' } }),
    env: { AGENT_TURN_STORE: store },
  } as never;
}

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

// ─── store 级测试 ───

test('025-01: fake store deleteTurnById 删除指定记录并返回 1', async () => {
  const store = new FakeAgentTurnStore();
  await store.insertTurn(makeTurn({ id: 'turn-1', createdAt: '2026-06-28T10:00:00.000Z' }));
  await store.insertTurn(makeTurn({ id: 'turn-2', createdAt: '2026-06-28T11:00:00.000Z' }));

  const window = { startInclusive: '2026-01-01T00:00:00.000Z', endExclusive: '2027-01-01T00:00:00.000Z' };
  const deleted = await store.deleteTurnById('turn-1', window);

  expect(deleted).toBe(1);
  expect(store.records).toHaveLength(1);
  expect(store.records[0].id).toBe('turn-2');
});

test('025-02: fake store deleteTurnById 找不到记录返回 0', async () => {
  const store = new FakeAgentTurnStore();
  await store.insertTurn(makeTurn({ id: 'turn-1', createdAt: '2026-06-28T10:00:00.000Z' }));

  const window = { startInclusive: '2026-01-01T00:00:00.000Z', endExclusive: '2027-01-01T00:00:00.000Z' };
  const deleted = await store.deleteTurnById('nonexistent', window);

  expect(deleted).toBe(0);
  expect(store.records).toHaveLength(1);
});

test('025-03: fake store deleteTurnsByRange 按窗口删除', async () => {
  const store = new FakeAgentTurnStore();
  await store.insertTurn(makeTurn({ id: 'turn-1', createdAt: '2026-06-28T10:00:00.000Z' }));
  await store.insertTurn(makeTurn({ id: 'turn-2', createdAt: '2026-06-29T10:00:00.000Z' }));
  await store.insertTurn(makeTurn({ id: 'turn-3', createdAt: '2026-06-30T10:00:00.000Z' }));

  const window = { startInclusive: '2026-06-28T00:00:00.000Z', endExclusive: '2026-06-30T00:00:00.000Z' };
  const deleted = await store.deleteTurnsByRange(window);

  expect(deleted).toBe(2);
  expect(store.records).toHaveLength(1);
  expect(store.records[0].id).toBe('turn-3');
});

test('025-04: fake store deleteAllTurns 清空所有记录', async () => {
  const store = new FakeAgentTurnStore();
  await store.insertTurn(makeTurn({ id: 'turn-1' }));
  await store.insertTurn(makeTurn({ id: 'turn-2' }));
  await store.insertTurn(makeTurn({ id: 'turn-3' }));

  const deleted = await store.deleteAllTurns();

  expect(deleted).toBe(3);
  expect(store.records).toHaveLength(0);
});

test('038-03: fake store deleteTurnsBySessionId 删除指定 Agent Session 下的所有记录', async () => {
  const store = new FakeAgentTurnStore();
  await store.insertTurn(makeTurn({ id: 'turn-1', agentSessionId: 'session-1', createdAt: '2026-06-28T10:00:00.000Z' }));
  await store.insertTurn(makeTurn({ id: 'turn-2', agentSessionId: 'session-1', createdAt: '2026-06-28T11:00:00.000Z' }));
  await store.insertTurn(makeTurn({ id: 'turn-3', agentSessionId: 'session-2', createdAt: '2026-06-28T12:00:00.000Z' }));

  const window = { startInclusive: '2026-06-28T00:00:00.000Z', endExclusive: '2026-06-29T00:00:00.000Z' };
  const deleted = await store.deleteTurnsBySessionId('session-1', window);

  expect(deleted).toBe(2);
  expect(store.records).toHaveLength(1);
  expect(store.records[0].id).toBe('turn-3');
});

// ─── API 级测试 ───

test('025-05: DELETE /api/admin/logs?id=<id> 删除单条记录', async () => {
  const store = new FakeAgentTurnStore();
  await store.insertTurn(makeTurn({ id: 'turn-1', createdAt: '2026-06-28T10:00:00.000Z' }));
  await store.insertTurn(makeTurn({ id: 'turn-2', createdAt: '2026-06-28T11:00:00.000Z' }));

  const ctx = makeDeleteContext(store, 'http://localhost/api/admin/logs?id=turn-1&period=all');
  const res = await onRequestDelete(ctx);
  const data = await (res as Response).json();

  expect(data.ok).toBe(true);
  expect(data.deleted).toBe(1);
  expect(store.records).toHaveLength(1);
  expect(store.records[0].id).toBe('turn-2');
});

test('025-06: DELETE /api/admin/logs?rangeStart=&rangeEnd= 按包含首尾日期的范围删除', async () => {
  const store = new FakeAgentTurnStore();
  await store.insertTurn(makeTurn({ id: 'turn-1', createdAt: '2026-06-28T10:00:00.000Z' }));
  await store.insertTurn(makeTurn({ id: 'turn-2', createdAt: '2026-06-29T10:00:00.000Z' }));
  await store.insertTurn(makeTurn({ id: 'turn-3', createdAt: '2026-06-30T10:00:00.000Z' }));

  const ctx = makeDeleteContext(store, 'http://localhost/api/admin/logs?rangeStart=2026-06-28&rangeEnd=2026-06-29');
  const res = await onRequestDelete(ctx);
  const data = await (res as Response).json();

  expect(data.ok).toBe(true);
  expect(data.deleted).toBe(2);
  expect(store.records).toHaveLength(1);
  expect(store.records[0].id).toBe('turn-3');
});

test('042-01: date-only 同日范围删除包含完整上海自然日', async () => {
  const store = new FakeAgentTurnStore();
  await store.insertTurn(makeTurn({ id: 'before', agentSessionId: 'session-before', createdAt: '2026-06-27T15:59:59.999Z' }));
  await store.insertTurn(makeTurn({ id: 'start', agentSessionId: 'session-start', createdAt: '2026-06-27T16:00:00.000Z' }));
  await store.insertTurn(makeTurn({ id: 'end-before', agentSessionId: 'session-end-before', createdAt: '2026-06-28T15:59:59.999Z' }));
  await store.insertTurn(makeTurn({ id: 'next-day', agentSessionId: 'session-next-day', createdAt: '2026-06-28T16:00:00.000Z' }));

  const deleteResponse = await onRequestDelete(makeDeleteContext(
    store,
    'http://localhost/api/admin/logs?rangeStart=2026-06-28&rangeEnd=2026-06-28',
  ));
  const deletePayload = await deleteResponse.json() as { ok: boolean; deleted: number };

  const listResponse = await onRequestGet(makeContext(
    store,
    'http://localhost/api/admin/logs?startDate=2026-06-27&endDate=2026-06-29',
  ));
  const listPayload = await listResponse.json() as { ok: boolean; data: { items: Array<{ id: string }> } };

  expect(deletePayload).toEqual({ ok: true, deleted: 2 });
  expect(listPayload.data.items.map((item) => item.id).sort()).toEqual(['session-before', 'session-next-day']);
});

test('042-02: date-only 范围缺少任一边界时返回 400 且不删除记录', async () => {
  const store = new FakeAgentTurnStore();
  await store.insertTurn(makeTurn({ id: 'turn-1', agentSessionId: 'session-1', createdAt: '2026-06-28T10:00:00.000Z' }));

  const deleteResponse = await onRequestDelete(makeDeleteContext(
    store,
    'http://localhost/api/admin/logs?rangeStart=2026-06-28',
  ));
  const deletePayload = await deleteResponse.json();

  const listResponse = await onRequestGet(makeContext(
    store,
    'http://localhost/api/admin/logs?startDate=2026-06-28&endDate=2026-06-28',
  ));
  const listPayload = await listResponse.json() as { data: { items: Array<{ id: string }> } };

  expect(deleteResponse.status).toBe(400);
  expect(deletePayload).toEqual({ ok: false, reason: 'invalid_date_range' });
  expect(listPayload.data.items.map((item) => item.id)).toEqual(['session-1']);
});

test('025-07: DELETE /api/admin/logs?all=true&confirm=DELETE 全清', async () => {
  const store = new FakeAgentTurnStore();
  await store.insertTurn(makeTurn({ id: 'turn-1' }));
  await store.insertTurn(makeTurn({ id: 'turn-2' }));

  const ctx = makeDeleteContext(store, 'http://localhost/api/admin/logs?all=true&confirm=DELETE');
  const res = await onRequestDelete(ctx);
  const data = await (res as Response).json();

  expect(data.ok).toBe(true);
  expect(data.deleted).toBe(2);
  expect(store.records).toHaveLength(0);
});

test('038-04: DELETE /api/admin/logs?sessionId=<id>&confirm=true 删除整段多轮 Agent Session', async () => {
  const store = new FakeAgentTurnStore();
  await store.insertTurn(makeTurn({ id: 'turn-1', agentSessionId: 'session-1', createdAt: '2026-06-28T10:00:00.000Z' }));
  await store.insertTurn(makeTurn({ id: 'turn-2', agentSessionId: 'session-1', createdAt: '2026-06-28T11:00:00.000Z' }));
  await store.insertTurn(makeTurn({ id: 'turn-3', agentSessionId: 'session-2', createdAt: '2026-06-28T12:00:00.000Z' }));

  const ctx = makeDeleteContext(store, 'http://localhost/api/admin/logs?sessionId=session-1&period=all&confirm=true');
  const res = await onRequestDelete(ctx);
  const data = await (res as Response).json();

  expect(data.ok).toBe(true);
  expect(data.deleted).toBe(2);
  expect(store.records).toHaveLength(1);
  expect(store.records[0].agentSessionId).toBe('session-2');
});

test('043-04: 服务端按 Session 全量轮数要求多轮删除确认', async () => {
  const store = new FakeAgentTurnStore();
  await store.insertTurn(makeTurn({ id: 'turn-1', agentSessionId: 'session-cross-window', createdAt: '2026-06-27T10:00:00.000Z' }));
  await store.insertTurn(makeTurn({ id: 'turn-2', agentSessionId: 'session-cross-window', createdAt: '2026-06-28T10:00:00.000Z' }));

  const unconfirmedResponse = await onRequestDelete(makeDeleteContext(
    store,
    'http://localhost/api/admin/logs?sessionId=session-cross-window',
  ));
  const unconfirmedPayload = await unconfirmedResponse.json();

  expect(unconfirmedPayload).toEqual({ ok: false, reason: 'confirm_required', count: 2 });
  expect(store.records).toHaveLength(2);

  const confirmedResponse = await onRequestDelete(makeDeleteContext(
    store,
    'http://localhost/api/admin/logs?sessionId=session-cross-window&confirm=true',
  ));
  await expect(confirmedResponse.json()).resolves.toEqual({ ok: true, deleted: 2 });
  expect(store.records).toHaveLength(0);
});

test('025-08: DELETE /api/admin/logs?all=true 缺少 confirm 返回错误', async () => {
  const store = new FakeAgentTurnStore();
  await store.insertTurn(makeTurn({ id: 'turn-1' }));

  const ctx = makeDeleteContext(store, 'http://localhost/api/admin/logs?all=true');
  const res = await onRequestDelete(ctx);
  const data = await (res as Response).json();

  expect(data.ok).toBe(false);
  expect(data.reason).toBe('confirm_required');
  expect(store.records).toHaveLength(1);
});

test('025-09: DELETE /api/admin/logs?all=true&confirm=WRONG confirm 值错误返回错误', async () => {
  const store = new FakeAgentTurnStore();
  await store.insertTurn(makeTurn({ id: 'turn-1' }));

  const ctx = makeDeleteContext(store, 'http://localhost/api/admin/logs?all=true&confirm=WRONG');
  const res = await onRequestDelete(ctx);
  const data = await (res as Response).json();

  expect(data.ok).toBe(false);
  expect(data.reason).toBe('confirm_required');
  expect(store.records).toHaveLength(1);
});

test('025-10: DELETE /api/admin/logs store 不可用时返回 db_unavailable', async () => {
  const store = new FakeAgentTurnStore();
  store.shouldFailDelete = true;
  await store.insertTurn(makeTurn({ id: 'turn-1' }));

  const ctx = makeDeleteContext(store, 'http://localhost/api/admin/logs?id=turn-1');
  const res = await onRequestDelete(ctx);
  const data = await (res as Response).json();

  expect(data.ok).toBe(false);
  expect(data.reason).toBe('db_unavailable');
});
