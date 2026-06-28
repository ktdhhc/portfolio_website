import { test, expect } from '@playwright/test';
import { onRequestPost } from '../functions/api/chat';
import { FakeAgentTurnStore } from '../functions/api/_store/fake';

function extractErrorFromSse(body: string): string {
  const events = body.split('\n\n').filter((event) => event.startsWith('data:'));
  for (const event of events) {
    const json = JSON.parse(event.replace(/^data:\s*/, '')) as {
      readonly type?: string;
      readonly content?: string;
    };
    if (json.type === 'error') return json.content ?? 'Unknown error';
  }
  return '';
}

// ─────────────────────────────
// Issue 020: `answer_status` 三档语义扩展
// ─────────────────────────────

test('020-01: 正常完成时 answerStatus 记为 success', async () => {
  const fakeTurnStore = new FakeAgentTurnStore();
  const response = await onRequestPost({
    request: new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorUuid: 'test-uuid-020a',
        agentSessionId: 'test-session-020a',
        messages: [{ role: 'user', content: '你好' }],
      }),
    }),
    env: { ACTIVE_PROVIDER: 'test', AGENT_TURN_STORE: fakeTurnStore },
  } as never);
  await response.text();
  expect(response.status).toBe(200);
  expect(fakeTurnStore.records).toHaveLength(1);
  expect(fakeTurnStore.records[0].answerStatus).toBe('success');
});

test('020-02: 达到资料查阅上限时 answerStatus 记为 degraded', async () => {
  const fakeTurnStore = new FakeAgentTurnStore();
  const response = await onRequestPost({
    request: new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorUuid: 'test-uuid-020b',
        agentSessionId: 'test-session-020b',
        messages: [{ role: 'user', content: '请触发无限工具调用' }],
      }),
    }),
    env: { ACTIVE_PROVIDER: 'test', AGENT_TURN_STORE: fakeTurnStore },
  } as never);
  const body = await response.text();
  expect(response.status).toBe(200);
  expect(body).toContain('已达到资料查阅上限');
  expect(fakeTurnStore.records).toHaveLength(1);
  expect(fakeTurnStore.records[0].answerStatus).toBe('degraded');
});

test('020-03: tool 调用失败但有回退回答时 answerStatus 记为 degraded', async () => {
  const fakeTurnStore = new FakeAgentTurnStore();
  const response = await onRequestPost({
    request: new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorUuid: 'test-uuid-020c',
        agentSessionId: 'test-session-020c',
        messages: [{ role: 'user', content: '请读取非法文件' }],
      }),
    }),
    env: { ACTIVE_PROVIDER: 'test', AGENT_TURN_STORE: fakeTurnStore },
  } as never);
  const body = await response.text();
  expect(response.status).toBe(200);
  expect(body).toContain('查阅部分资料时遇到问题');
  expect(body).not.toContain('"type":"error"');
  expect(fakeTurnStore.records).toHaveLength(1);
  expect(fakeTurnStore.records[0].answerStatus).toBe('degraded');
});

test('020-04: provider 调用失败时 answerStatus 记为 failed', async () => {
  const fakeTurnStore = new FakeAgentTurnStore();
  const response = await onRequestPost({
    request: new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorUuid: 'test-uuid-020d',
        agentSessionId: 'test-session-020d',
        messages: [{ role: 'user', content: '请模拟 provider 超时' }],
      }),
    }),
    env: { ACTIVE_PROVIDER: 'test', AGENT_TURN_STORE: fakeTurnStore },
  } as never);
  const body = await response.text();
  expect(response.status).toBe(200);
  expect(extractErrorFromSse(body)).toContain('Provider timeout');
  expect(fakeTurnStore.records).toHaveLength(1);
  expect(fakeTurnStore.records[0].answerStatus).toBe('failed');
});

test('020-05: D1 写入失败时 answerStatus 仍只反映 Agent 自身表现', async () => {
  let capturedStatus = '';
  const failingStore = {
    async insertTurn(record: { readonly answerStatus: string }) {
      capturedStatus = record.answerStatus;
      throw new Error('D1 unavailable');
    },
  };
  const response = await onRequestPost({
    request: new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorUuid: 'test-uuid-020e',
        agentSessionId: 'test-session-020e',
        messages: [{ role: 'user', content: '你好' }],
      }),
    }),
    env: { ACTIVE_PROVIDER: 'test', AGENT_TURN_STORE: failingStore },
  } as never);
  const body = await response.text();
  expect(response.status).toBe(200);
  expect(body).toContain('Candidate Agent');
  expect(capturedStatus).toBe('success');
});

test('020-06: provider 初始化失败时 answerStatus 记为 failed', async () => {
  const fakeTurnStore = new FakeAgentTurnStore();
  const response = await onRequestPost({
    request: new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorUuid: 'test-uuid-020f',
        agentSessionId: 'test-session-020f',
        messages: [{ role: 'user', content: '你好' }],
      }),
    }),
    env: { ACTIVE_PROVIDER: 'unknown-provider', AGENT_TURN_STORE: fakeTurnStore },
  } as never);
  const body = await response.text();
  expect(response.status).toBe(200);
  expect(extractErrorFromSse(body)).toContain('Unknown ACTIVE_PROVIDER');
  expect(fakeTurnStore.records).toHaveLength(1);
  expect(fakeTurnStore.records[0].answerStatus).toBe('failed');
});
