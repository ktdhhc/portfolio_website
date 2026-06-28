import { expect, test } from '@playwright/test';
import { onRequestGet as getAdminLogs } from '../functions/api/admin/logs';
import { StoreUnavailableError } from '../functions/api/_store/errors';
import { FakeAgentTurnStore } from '../functions/api/_store/fake';
import type { AgentTurnRecord } from '../functions/api/_store/types';

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

  globalThis.Date = MockDate;
  try {
    return await fn();
  } finally {
    globalThis.Date = RealDate;
  }
}

function makeTurn(partial: Partial<AgentTurnRecord>): AgentTurnRecord {
  return {
    visitorUuid: partial.visitorUuid ?? 'visitor-1',
    agentSessionId: partial.agentSessionId ?? 'session-1',
    turnType: partial.turnType ?? 'chat',
    userMessage: partial.userMessage ?? '你好',
    assistantAnswer: partial.assistantAnswer ?? '回答',
    answerStatus: partial.answerStatus ?? 'success',
    durationMs: partial.durationMs ?? 100,
    toolTrace: partial.toolTrace,
    createdAt: partial.createdAt ?? '2026-06-28T10:00:00.000Z',
  };
}

test('024-01: GET /api/admin/logs 返回当前窗口分页列表且列表字段集受限', async () => {
  const turnStore = new FakeAgentTurnStore();
  turnStore.records = [
    makeTurn({ userMessage: 'a'.repeat(120), createdAt: '2026-06-28T10:00:00.000Z' }),
    makeTurn({ userMessage: '第二条记录', createdAt: '2026-06-28T11:00:00.000Z', turnType: 'jd_analysis', answerStatus: 'degraded' }),
    makeTurn({ userMessage: '窗口外记录', createdAt: '2026-06-27T15:00:00.000Z' }),
  ];

  const response = await withMockedNow('2026-06-28T12:00:00.000Z', () =>
    getAdminLogs({
      request: new Request('http://localhost/api/admin/logs?period=today&page=1&pageSize=1', {
        method: 'GET',
        headers: { Authorization: 'Bearer secret-admin-token' },
      }),
      env: {
        ADMIN_TOKEN: 'secret-admin-token',
        AGENT_TURN_STORE: turnStore,
      },
    } as never),
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    ok: true,
    data: {
      items: [
        {
          id: '2',
          createdAt: '2026-06-28T11:00:00.000Z',
          userMessage: '第二条记录',
          turnType: 'jd_analysis',
          answerStatus: 'degraded',
        },
      ],
      total: 2,
      page: 1,
      pageSize: 1,
      totalPages: 2,
    },
  });
});

test('024-02: GET /api/admin/logs 对无效 page 回退到 1，pageSize 默认 20 且最大 100', async () => {
  const turnStore = new FakeAgentTurnStore();
  turnStore.records = Array.from({ length: 105 }, (_, index) =>
    makeTurn({
      userMessage: `记录-${index + 1}`,
      createdAt: `2026-06-28T20:${String(index % 60).padStart(2, '0')}:${String(Math.floor(index / 60)).padStart(2, '0')}.000Z`,
    }),
  );

  const defaultResponse = await withMockedNow('2026-06-28T23:00:00.000Z', () =>
    getAdminLogs({
      request: new Request('http://localhost/api/admin/logs?period=today&page=0', { method: 'GET' }),
      env: { ADMIN_TOKEN: 'secret-admin-token', AGENT_TURN_STORE: turnStore },
    } as never),
  );
  const defaultPayload = await defaultResponse.json() as { ok: boolean; data: { items: unknown[]; page: number; pageSize: number; totalPages: number } };
  expect(defaultPayload.ok).toBe(true);
  expect(defaultPayload.data.page).toBe(1);
  expect(defaultPayload.data.pageSize).toBe(20);
  expect(defaultPayload.data.items).toHaveLength(20);

  const clampedResponse = await withMockedNow('2026-06-28T23:00:00.000Z', () =>
    getAdminLogs({
      request: new Request('http://localhost/api/admin/logs?period=today&page=1&pageSize=999', { method: 'GET' }),
      env: { ADMIN_TOKEN: 'secret-admin-token', AGENT_TURN_STORE: turnStore },
    } as never),
  );
  const clampedPayload = await clampedResponse.json() as { ok: boolean; data: { items: unknown[]; pageSize: number; totalPages: number } };
  expect(clampedPayload.ok).toBe(true);
  expect(clampedPayload.data.pageSize).toBe(100);
  expect(clampedPayload.data.items).toHaveLength(100);
  expect(clampedPayload.data.totalPages).toBe(2);
});

test('024-03: GET /api/admin/logs?id=<id> 返回详情字段集与 toolTrace 摘要', async () => {
  const turnStore = new FakeAgentTurnStore();
  turnStore.records = [
    makeTurn({
      userMessage: '完整用户问题',
      assistantAnswer: '完整回答',
      toolTrace: { toolCalls: 2, files: ['resume.json', 'projects/aindexer/index.md'] },
      visitorUuid: '12345678-aaaa-bbbb-cccc-ddddeeeeffff',
      agentSessionId: '87654321-aaaa-bbbb-cccc-ddddeeeeffff',
      createdAt: '2026-06-28T11:00:00.000Z',
    }),
  ];

  const response = await withMockedNow('2026-06-28T12:00:00.000Z', () =>
    getAdminLogs({
      request: new Request('http://localhost/api/admin/logs?period=today&id=1', { method: 'GET' }),
      env: { ADMIN_TOKEN: 'secret-admin-token', AGENT_TURN_STORE: turnStore },
    } as never),
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    ok: true,
    data: {
      item: {
        id: '1',
        createdAt: '2026-06-28T11:00:00.000Z',
        userMessage: '完整用户问题',
        assistantAnswer: '完整回答',
        turnType: 'chat',
        answerStatus: 'success',
        durationMs: 100,
        toolTraceSummary: {
          toolCalls: 2,
          files: ['resume.json', 'projects/aindexer/index.md'],
        },
        visitorUuidShort: '12345678',
        agentSessionIdShort: '87654321',
      },
    },
  });
});

test('024-04: store 不可用时 /api/admin/logs 返回 db_unavailable', async () => {
  const turnStore = new FakeAgentTurnStore();
  turnStore.listLogs = async () => {
    throw new StoreUnavailableError();
  };

  const response = await withMockedNow('2026-06-28T12:00:00.000Z', () =>
    getAdminLogs({
      request: new Request('http://localhost/api/admin/logs?period=today&page=1&pageSize=20', { method: 'GET' }),
      env: { ADMIN_TOKEN: 'secret-admin-token', AGENT_TURN_STORE: turnStore },
    } as never),
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ ok: false, reason: 'db_unavailable' });
});
