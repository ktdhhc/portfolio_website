import { test, expect } from '@playwright/test';
import { onRequestGet as getAgentSummary } from '../functions/api/admin/stats/agent-summary';
import { onRequestGet as getIssues } from '../functions/api/admin/stats/issues';
import { onRequestGet as getOverview } from '../functions/api/admin/stats/overview';
import { onRequestGet as getPages } from '../functions/api/admin/stats/pages';
import { onRequestGet as getProjects } from '../functions/api/admin/stats/projects';
import { StoreUnavailableError } from '../functions/api/_store/errors';
import { FakeAgentTurnStore, FakeBehaviorEventStore } from '../functions/api/_store/fake';
import type { AgentTurnRecord, BehaviorEventRecord, StoreWriteFailureRecord } from '../functions/api/_store/types';

type StatsHandler = typeof getOverview;

async function withMockedNow<T>(iso: string, fn: () => Promise<T>): Promise<T> {
  const RealDate = Date;
  const fixed = new RealDate(iso);
  type MockDateArgs = [] | [string | number | Date] | [number, number, number?, number?, number?, number?, number?];
  class MockDate extends RealDate {
    constructor(...args: MockDateArgs) {
      if (args.length === 0) {
        super(fixed.toISOString());
        return;
      }
      if (args.length === 1) {
        super(args[0]);
        return;
      }
      const [year, month, date, hours, minutes, seconds, milliseconds] = args;
      super(year, month, date, hours, minutes, seconds, milliseconds);
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

async function callStats(
  handler: StatsHandler,
  path: string,
  env?: Record<string, unknown>,
) {
  return handler({
    request: new Request(`http://localhost${path}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer secret-admin-token' },
    }),
    env: {
      ADMIN_TOKEN: 'secret-admin-token',
      ...(env ?? {}),
    },
  } as never);
}

function makeBehaviorEvent(partial: Partial<BehaviorEventRecord>): BehaviorEventRecord {
  return {
    visitorUuid: partial.visitorUuid ?? 'visitor-1',
    eventType: partial.eventType ?? 'page_view',
    createdAt: partial.createdAt ?? '2026-06-28T10:00:00.000Z',
    agentSessionId: partial.agentSessionId,
    path: partial.path,
    targetKind: partial.targetKind,
    targetId: partial.targetId,
    durationMs: partial.durationMs,
    metadata: partial.metadata,
  };
}

function makeAgentTurn(partial: Partial<AgentTurnRecord>): AgentTurnRecord {
  return {
    visitorUuid: partial.visitorUuid ?? 'visitor-1',
    agentSessionId: partial.agentSessionId ?? 'session-1',
    turnType: partial.turnType ?? 'chat',
    userMessage: partial.userMessage ?? '你好',
    assistantAnswer: partial.assistantAnswer ?? '回答',
    answerStatus: partial.answerStatus ?? 'success',
    durationMs: partial.durationMs ?? 120,
    toolTrace: partial.toolTrace,
    createdAt: partial.createdAt ?? '2026-06-28T10:00:00.000Z',
  };
}

function makeWriteFailure(occurredAt: string): StoreWriteFailureRecord {
  return { occurredAt };
}

test('022-01: pages 端点只统计当前窗口内的 page_view 并按计数降序输出', async () => {
  const eventStore = new FakeBehaviorEventStore();
  eventStore.records = [
    makeBehaviorEvent({ eventType: 'page_view', path: '/', createdAt: '2026-06-28T09:00:00.000Z' }),
    makeBehaviorEvent({ eventType: 'page_view', path: '/', createdAt: '2026-06-28T09:10:00.000Z' }),
    makeBehaviorEvent({ eventType: 'page_view', path: '/resume', createdAt: '2026-06-28T09:20:00.000Z' }),
    makeBehaviorEvent({ eventType: 'project_click', path: '/', targetId: 'aindexer', createdAt: '2026-06-28T09:30:00.000Z' }),
    makeBehaviorEvent({ eventType: 'page_view', path: '/projects', createdAt: '2026-06-27T15:59:00.000Z' }),
  ];

  const response = await withMockedNow('2026-06-28T10:00:00.000Z', () =>
    callStats(getPages, '/api/admin/stats/pages?period=today', { BEHAVIOR_EVENT_STORE: eventStore }),
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    ok: true,
    data: {
      items: [
        { path: '/', count: 2 },
        { path: '/resume', count: 1 },
      ],
    },
  });
});

test('022-02: pages 端点的 week 窗口从周一 00:00 起算（不是滚动 7 天）', async () => {
  const eventStore = new FakeBehaviorEventStore();
  eventStore.records = [
    makeBehaviorEvent({ eventType: 'page_view', path: '/week', createdAt: '2026-06-22T01:00:00.000Z' }),
    makeBehaviorEvent({ eventType: 'page_view', path: '/old', createdAt: '2026-06-21T15:30:00.000Z' }),
  ];

  const response = await withMockedNow('2026-06-24T08:00:00.000Z', () =>
    callStats(getPages, '/api/admin/stats/pages?period=week', { BEHAVIOR_EVENT_STORE: eventStore }),
  );

  await expect(response.json()).resolves.toEqual({
    ok: true,
    data: {
      items: [{ path: '/week', count: 1 }],
    },
  });
});

test('022-03: overview 端点 month 窗口按自然月统计，并带上个完整自然月对照', async () => {
  const eventStore = new FakeBehaviorEventStore();
  eventStore.records = [
    makeBehaviorEvent({ eventType: 'page_view', createdAt: '2026-07-02T09:00:00.000Z' }),
    makeBehaviorEvent({ eventType: 'pdf_download', createdAt: '2026-07-02T09:10:00.000Z' }),
    makeBehaviorEvent({ eventType: 'page_duration', durationMs: 3_000, createdAt: '2026-07-02T09:20:00.000Z' }),
    makeBehaviorEvent({ eventType: 'page_view', createdAt: '2026-06-15T09:00:00.000Z' }),
    makeBehaviorEvent({ eventType: 'page_duration', durationMs: 9_000, createdAt: '2026-06-15T09:20:00.000Z' }),
  ];
  const turnStore = new FakeAgentTurnStore();
  turnStore.records = [
    makeAgentTurn({ turnType: 'chat', answerStatus: 'success', createdAt: '2026-07-02T09:30:00.000Z' }),
    makeAgentTurn({ turnType: 'jd_analysis', answerStatus: 'degraded', createdAt: '2026-07-02T09:31:00.000Z' }),
    makeAgentTurn({ turnType: 'chat', answerStatus: 'failed', createdAt: '2026-06-15T09:31:00.000Z' }),
  ];

  const response = await withMockedNow('2026-07-02T10:00:00.000Z', () =>
    callStats(getOverview, '/api/admin/stats/overview?period=month', {
      BEHAVIOR_EVENT_STORE: eventStore,
      AGENT_TURN_STORE: turnStore,
    }),
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    ok: true,
    data: {
      metrics: {
        pageViews: { current: 1, previous: 1 },
        pdfDownloads: { current: 1, previous: 0 },
        agentTurns: { current: 2, previous: 1 },
        jdAnalyses: { current: 1, previous: 0 },
        avgPageDurationMs: { current: 3000, previous: 9000 },
        agentFailures: { current: 1, previous: 1 },
      },
    },
  });
});

test('022-04: projects 端点只统计 project_click 并按 targetId 聚合', async () => {
  const eventStore = new FakeBehaviorEventStore();
  eventStore.records = [
    makeBehaviorEvent({ eventType: 'project_click', targetId: 'aindexer', createdAt: '2026-06-28T09:00:00.000Z' }),
    makeBehaviorEvent({ eventType: 'project_click', targetId: 'aindexer', createdAt: '2026-06-28T09:01:00.000Z' }),
    makeBehaviorEvent({ eventType: 'project_click', targetId: 'character-memory', createdAt: '2026-06-28T09:02:00.000Z' }),
    makeBehaviorEvent({ eventType: 'external_click', targetId: 'https://github.com', createdAt: '2026-06-28T09:03:00.000Z' }),
  ];

  const response = await withMockedNow('2026-06-28T10:00:00.000Z', () =>
    callStats(getProjects, '/api/admin/stats/projects?period=today', { BEHAVIOR_EVENT_STORE: eventStore }),
  );

  await expect(response.json()).resolves.toEqual({
    ok: true,
    data: {
      items: [
        { targetId: 'aindexer', count: 2 },
        { targetId: 'character-memory', count: 1 },
      ],
    },
  });
});

test('022-05: agent-summary 端点按固定词表匹配关键词，同一提问可命中多个关键词', async () => {
  const turnStore = new FakeAgentTurnStore();
  turnStore.records = [
    makeAgentTurn({ userMessage: '请做 JD 分析，并说明 Aindexer 的技术栈', createdAt: '2026-06-28T09:00:00.000Z' }),
    makeAgentTurn({ userMessage: '我想了解你的项目经验和工作方式', createdAt: '2026-06-28T09:05:00.000Z' }),
  ];

  const response = await withMockedNow('2026-06-28T10:00:00.000Z', () =>
    callStats(getAgentSummary, '/api/admin/stats/agent-summary?period=today', { AGENT_TURN_STORE: turnStore }),
  );

  const payload = await response.json() as { ok: boolean; data: { items: Array<{ keyword: string; count: number }> } };
  expect(payload.ok).toBe(true);
  expect(payload.data.items).toEqual(
    expect.arrayContaining([
      { keyword: 'Aindexer', count: 1 },
      { keyword: 'JD 分析', count: 1 },
      { keyword: '工作方式', count: 1 },
      { keyword: '技术栈', count: 1 },
      { keyword: '项目经验', count: 1 },
    ]),
  );
  expect(payload.data.items).toHaveLength(5);
});

test('022-06: issues 端点独立聚合 degraded/failed 与 D1 写入失败计数', async () => {
  const turnStore = new FakeAgentTurnStore();
  turnStore.records = [
    makeAgentTurn({ answerStatus: 'degraded', createdAt: '2026-06-28T09:00:00.000Z' }),
    makeAgentTurn({ answerStatus: 'degraded', createdAt: '2026-06-28T09:01:00.000Z' }),
    makeAgentTurn({ answerStatus: 'failed', createdAt: '2026-06-28T09:02:00.000Z' }),
  ];
  turnStore.writeFailures = [makeWriteFailure('2026-06-28T09:10:00.000Z')];
  const eventStore = new FakeBehaviorEventStore();
  eventStore.writeFailures = [makeWriteFailure('2026-06-28T09:11:00.000Z')];

  const response = await withMockedNow('2026-06-28T10:00:00.000Z', () =>
    callStats(getIssues, '/api/admin/stats/issues?period=today', {
      BEHAVIOR_EVENT_STORE: eventStore,
      AGENT_TURN_STORE: turnStore,
    }),
  );

  await expect(response.json()).resolves.toEqual({
    ok: true,
    data: {
      items: [
        { kind: 'degraded', count: 2 },
        { kind: 'failed', count: 1 },
        { kind: 'd1_write_failure', count: 2 },
      ],
    },
  });
});

test('022-07: store 抛错时 stats 端点返回 db_unavailable', async () => {
  const failingStore = {
    async listEvents() {
      throw new StoreUnavailableError();
    },
    async listWriteFailures() {
      return [];
    },
  };

  const response = await callStats(getPages, '/api/admin/stats/pages?period=today', {
    BEHAVIOR_EVENT_STORE: failingStore,
  });

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ ok: false, reason: 'db_unavailable' });
});
