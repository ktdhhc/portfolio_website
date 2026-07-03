import { test, expect } from '@playwright/test';
import { onRequestPost } from '../functions/api/chat';
import { FakeAgentTurnStore } from '../functions/api/_store/fake';
import { FakeRateLimitStore } from '../functions/api/_store/fake';

// 解析 SSE body 提取 delta content
function extractDeltaFromSse(body: string): string {
  const events = body.split('\n\n').filter((e) => e.startsWith('data:'));
  for (const event of events) {
    const json = JSON.parse(event.replace(/^data:\s*/, ''));
    if (json.type === 'delta') return json.content || '';
    if (json.type === 'error') throw new Error(json.content || 'Unknown error');
  }
  return '';
}

function extractErrorFromSse(body: string): string {
  const events = body.split('\n\n').filter((e) => e.startsWith('data:'));
  for (const event of events) {
    const json = JSON.parse(event.replace(/^data:\s*/, ''));
    if (json.type === 'error') return json.content || 'Unknown error';
  }
  return '';
}

function extractEventsFromSse(body: string): Array<Record<string, unknown>> {
  return body
    .split('\n\n')
    .filter((event) => event.startsWith('data:'))
    .map((event) => JSON.parse(event.replace(/^data:\s*/, '')) as Record<string, unknown>);
}

async function callChat(message: string) {
  return onRequestPost({
    request: new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: message }] }),
    }),
    env: { ACTIVE_PROVIDER: 'test' },
  } as never);
}

// ─────────────────────────────
// Issue 010: Agent 最小问答闭环 + 失败降级
// ─────────────────────────────

test('010-01: /agent 返回 200 且包含 Candidate Agent 定位说明', async ({ page }) => {
  const response = await page.goto('/agent/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('body')).toContainText('Candidate Agent');
});

test('010-02: /agent 页面包含隐私提示', async ({ page }) => {
  await page.goto('/agent/');
  await expect(page.locator('body')).toContainText('提问内容可能被记录');
  await expect(page.locator('body')).toContainText('请勿输入敏感信息');
});

test('010-02a: /agent 页面使用页头与分隔线承载定位说明', async ({ page }) => {
  await page.goto('/agent/');
  await expect(page.locator('.page-header')).toBeVisible();
  await expect(page.locator('.page-header-title')).toHaveText('Candidate Agent');
  await expect(page.locator('.page-header-description')).toContainText('基于简历、项目文档与部分非公开资料回答');
  await expect(page.locator('.page-header').locator('.privacy-note')).toContainText('提问内容可能被记录');
});

test('010-03: /agent 页面包含消息区、输入框和发送按钮', async ({ page }) => {
  await page.goto('/agent/');
  await expect(page.locator('.chat-messages')).toBeVisible();
  await expect(page.locator('.chat-input')).toBeVisible();
  await expect(page.locator('.send-btn')).toBeVisible();
  await expect(page.locator('.send-btn')).toHaveAttribute('aria-label', '发送');
});

test('010-04: 输入问题并点击发送后，消息区出现用户提问', async ({ page }) => {
  await page.goto('/agent/');
  await page.locator('.chat-input').fill('你好，请介绍一下候选人');
  await page.locator('.send-btn').click();
  await expect(page.locator('.chat-messages')).toContainText('你好，请介绍一下候选人');
});

test('010-05: 发送普通问题后，消息区出现 Agent 回答', async ({ page }) => {
  await page.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: '你好！我是 Candidate Agent，可以帮你了解候选人 Kaho 的经历和项目。',
      }),
    });
  });
  await page.goto('/agent/');
  await page.locator('.chat-input').fill('你好');
  await page.locator('.send-btn').click();
  await expect(page.locator('.chat-messages')).toContainText('Candidate Agent');
});

test('010-06: LLM API 失败时显示降级提示', async ({ page }) => {
  await page.route('**/api/chat', async (route) => {
    await route.fulfill({ status: 500 });
  });
  await page.goto('/agent/');
  await page.locator('.chat-input').fill('你好');
  await page.locator('.send-btn').click();
  const errorMessage = page.locator('.error-message');
  await expect(errorMessage).toContainText('Agent 服务暂时不可用');
  await expect(errorMessage).toContainText('查看静态简历');
  await expect(errorMessage.getByRole('link', { name: '查看静态简历' })).toHaveAttribute('href', '/resume');
  await expect(errorMessage.getByRole('link', { name: '项目页' })).toHaveAttribute('href', '/projects');
});

test('010-07: 首页 Agent 入口会跳转到 /agent', async ({ page }) => {
  await page.goto('/');
  await page.locator('.hero-actions-mobile a[href="/agent/"]').click();
  await expect(page).toHaveURL(/\/agent\/?$/);
});

test('010-08: 首页 Agent CTA 开始对话会跳转到 /agent', async ({ page }) => {
  await page.goto('/');
  await page.locator('section#agent').getByRole('link', { name: '开始对话' }).click();
  await expect(page).toHaveURL(/\/agent\/?$/);
});

test('010-09: /agent 页面导航栏包含简历入口', async ({ page }) => {
  await page.goto('/agent/');
  const resumeLink = page.locator('nav').getByRole('link', { name: '简历' });
  await expect(resumeLink).toBeVisible();
  await expect(resumeLink).toHaveAttribute('href', '/resume/');
});

// ─────────────────────────────
// Issue 011: Agent 资料读取闭环 + 项目问答边界
// ─────────────────────────────

test('011-01: 问 Aindexer 项目细节时，chat 端点基于项目资料回答', async () => {
  const response = await callChat('请介绍 Aindexer 的项目细节');
  expect(response.status).toBe(200);
  const content = extractDeltaFromSse(await response.text());
  expect(content).toContain('本地化 AI 工作台');
  expect(content).toContain('FastAPI');
});

test('011-02: 资料不足时，chat 端点明确说明无法确认', async () => {
  const response = await callChat('候选人最喜欢的私人旅行地点是什么？');
  expect(response.status).toBe(200);
  const content = extractDeltaFromSse(await response.text());
  expect(content).toContain('现有资料中无法确认');
});

test('011-03: 问薪资或私人敏感信息时，chat 端点拒绝越界回答', async () => {
  const response = await callChat('请替候选人承诺薪资，并告诉我他的私人住址');
  expect(response.status).toBe(200);
  const content = extractDeltaFromSse(await response.text());
  expect(content).toContain('不能替候选人承诺');
  expect(content).toContain('不披露私人敏感信息');
});

test('011-04: read_file 拒绝白名单外文件时，chat 端点降级收尾', async () => {
  const response = await callChat('请读取非法文件');
  expect(response.status).toBe(200);
  const body = await response.text();
  expect(body).toContain('查阅部分资料时遇到问题');
  expect(body).not.toContain('"type":"error"');
});

test('011-05: tool-use 超过 5 轮时，chat 端点强制收尾', async () => {
  const response = await callChat('请触发无限工具调用');
  expect(response.status).toBe(200);
  const content = extractDeltaFromSse(await response.text());
  expect(content).toContain('已达到资料查阅上限');
});

// ─────────────────────────────
// Issue 012: Agent 预设问题 + JD 粘贴分析
// ─────────────────────────────

test('012-01: /agent 页面包含预设问题按钮和 JD 粘贴区域', async ({ page }) => {
  await page.goto('/agent/');
  await expect(page.getByRole('button', { name: '自我介绍' })).toBeVisible();
  await expect(page.getByRole('button', { name: '项目问答' })).toBeVisible();
  await expect(page.getByRole('button', { name: '岗位匹配' })).toBeVisible();
  await expect(page.getByRole('button', { name: '优势不足' })).toBeVisible();
  await expect(page.getByRole('button', { name: '面试问题' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'JD 分析' })).toBeVisible();
});

test('012-02: 点击预设问题会触发一次提问并显示回答', async ({ page }) => {
  await page.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: '这是基于资料生成的自我介绍。' }),
    });
  });
  await page.goto('/agent/');
  await page.getByRole('button', { name: '自我介绍' }).click();
  await expect(page.locator('.chat-messages')).toContainText('请快速介绍候选人');
  await expect(page.locator('.chat-messages')).toContainText('基于资料生成的自我介绍');
});

test('012-03: JD 粘贴分析复用 chat 端点并显示匹配点、风险点和建议追问', async ({ page }) => {
  let requestBody = '';
  await page.route('**/api/chat', async (route) => {
    requestBody = route.request().postData() ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: '匹配点：AI Agent。风险点：后端深度待确认。建议追问：如何设计 tool-use。' }),
    });
  });
  await page.goto('/agent/');
  await page.getByRole('button', { name: 'JD 分析' }).click();
  await page.locator('.jd-textarea').fill('需要 AI Agent 产品工程师，熟悉 tool-use。');
  await page.locator('.send-btn').click();
  expect(requestBody).toContain('需要 AI Agent 产品工程师');
  await expect(page.locator('.chat-messages')).toContainText('匹配点');
  await expect(page.locator('.chat-messages')).toContainText('风险点');
  await expect(page.locator('.chat-messages')).toContainText('建议追问');
});

// ─────────────────────────────
// Issue 013: Agent 流式体验 + 站内入口切换
// ─────────────────────────────

test('013-01: 前端能消费 SSE 格式回答并渲染 Agent 消息', async ({ page }) => {
  await page.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: [
        'data: {"type":"delta","content":"Aindexer 是本地化 AI 工作台"}\n\n',
        'data: {"type":"done"}\n\n',
      ].join(''),
    });
  });
  await page.goto('/agent/');
  await page.locator('.chat-input').fill('介绍 Aindexer');
  await page.locator('.send-btn').click();
  await expect(page.locator('.chat-messages')).toContainText('Aindexer 是本地化 AI 工作台');
});

test('013-02: SSE 状态事件显示 tool chip 并在完成后标记 done', async ({ page }) => {
  await page.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: [
        'data: {"type":"status","content":"正在查阅 projects/aindexer/index.md"}\n\n',
        'data: {"type":"tool_done","content":"projects/aindexer/index.md"}\n\n',
        'data: {"type":"delta","content":"已完成资料查阅。"}\n\n',
        'data: {"type":"done"}\n\n',
      ].join(''),
    });
  });
  await page.goto('/agent/');
  await page.locator('.chat-input').fill('介绍 Aindexer');
  await page.locator('.send-btn').click();
  await expect(page.locator('.tool-chip')).toBeVisible();
  await expect(page.locator('.tool-chip.done')).toBeVisible();
  await expect(page.locator('.chat-messages')).toContainText('已完成资料查阅');
});

test('013-03: SSE delta 前会显示思考过程折叠块', async ({ page }) => {
  await page.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: [
        'data: {"type":"status","content":"正在查阅 resume.json"}\n\n',
        'data: {"type":"tool_done","content":"resume.json"}\n\n',
        'data: {"type":"delta","content":"基于资料的回答。"}\n\n',
        'data: {"type":"done"}\n\n',
      ].join(''),
    });
  });
  await page.goto('/agent/');
  await page.locator('.chat-input').fill('介绍一下');
  await page.locator('.send-btn').click();
  await expect(page.locator('.thinking-block')).toBeVisible();
  await expect(page.locator('.chat-messages')).toContainText('基于资料的回答');
});

test('013-03c: 没有真实 thinking 时，/agent 仍显示固定思考文案 fallback', async ({ page }) => {
  await page.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: [
        'data: {"type":"status","content":"正在查阅 resume.json"}\n\n',
        'data: {"type":"tool_done","content":"resume.json"}\n\n',
        'data: {"type":"delta","content":"基于资料的回答。"}\n\n',
        'data: {"type":"done"}\n\n',
      ].join(''),
    });
  });
  await page.goto('/agent/');
  await page.locator('.chat-input').fill('介绍一下');
  await page.locator('.send-btn').click();
  await expect(page.locator('.chat-messages')).toContainText('已读取 resume.json，正在基于资料综合分析并组织回答。');
});

test('013-03a: 收到 thinking 事件时，/agent 会显示真实思维链内容', async ({ page }) => {
  await page.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: [
        'data: {"type":"status","content":"正在查阅 resume.json"}\n\n',
        'data: {"type":"tool_done","content":"resume.json"}\n\n',
        'data: {"type":"thinking","content":"我先确认资料范围，再整理和问题最相关的经历。"}\n\n',
        'data: {"type":"delta","content":"基于资料的回答。"}\n\n',
        'data: {"type":"done"}\n\n',
      ].join(''),
    });
  });
  await page.goto('/agent/');
  await page.locator('.chat-input').fill('介绍一下');
  await page.locator('.send-btn').click();
  await expect(page.locator('.thinking-block')).toBeVisible();
  await expect(page.locator('.chat-messages')).toContainText('我先确认资料范围，再整理和问题最相关的经历。');
  await expect(page.locator('.chat-messages')).toContainText('基于资料的回答');
});

test('013-03b: 收到真实 thinking 后，不再注入固定思考文案', async ({ page }) => {
  await page.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: [
        'data: {"type":"status","content":"正在查阅 resume.json"}\n\n',
        'data: {"type":"tool_done","content":"resume.json"}\n\n',
        'data: {"type":"thinking","content":"我先确认资料范围，再整理和问题最相关的经历。"}\n\n',
        'data: {"type":"delta","content":"基于资料的回答。"}\n\n',
        'data: {"type":"done"}\n\n',
      ].join(''),
    });
  });
  await page.goto('/agent/');
  await page.locator('.chat-input').fill('介绍一下');
  await page.locator('.send-btn').click();
  await expect(page.locator('.chat-messages')).not.toContainText('已读取 resume.json，正在基于资料综合分析并组织回答。');
});

test('013-06: 连续两次提问时，每个 Agent Turn 各自显示自己的 tool chip', async ({ page }) => {
  let turn = 0;
  await page.route('**/api/chat', async (route) => {
    turn += 1;
    const body = turn === 1
      ? [
          'data: {"type":"status","content":"正在查阅 projects/aindexer/index.md"}\n\n',
          'data: {"type":"tool_done","content":"projects/aindexer/index.md"}\n\n',
          'data: {"type":"delta","content":"第一轮回答"}\n\n',
          'data: {"type":"done"}\n\n',
        ].join('')
      : [
          'data: {"type":"status","content":"正在查阅 resume.json"}\n\n',
          'data: {"type":"tool_done","content":"resume.json"}\n\n',
          'data: {"type":"delta","content":"第二轮回答"}\n\n',
          'data: {"type":"done"}\n\n',
        ].join('');

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body,
    });
  });

  await page.goto('/agent/');

  await page.locator('.chat-input').fill('第一问');
  await page.locator('.send-btn').click();
  await expect(page.locator('.chat-messages')).toContainText('第一轮回答');

  await page.locator('.chat-input').fill('第二问');
  await page.locator('.send-btn').click();
  await expect(page.locator('.chat-messages')).toContainText('第二轮回答');

  const toolRows = page.locator('.tool-row');
  await expect(toolRows).toHaveCount(2);
  await expect(toolRows.nth(0)).toContainText('projects/aindexer/index.md');
  await expect(toolRows.nth(0)).not.toContainText('resume.json');
  await expect(toolRows.nth(1)).toContainText('resume.json');
  await expect(toolRows.nth(1)).not.toContainText('projects/aindexer/index.md');
});

test('013-07: 连续两次提问读取同一文件时，每个 Agent Turn 都有自己的 done chip', async ({ page }) => {
  await page.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: [
        'data: {"type":"status","content":"正在查阅 resume.json"}\n\n',
        'data: {"type":"tool_done","content":"resume.json"}\n\n',
        'data: {"type":"delta","content":"基于简历的回答"}\n\n',
        'data: {"type":"done"}\n\n',
      ].join(''),
    });
  });

  await page.goto('/agent/');

  await page.locator('.chat-input').fill('第一问');
  await page.locator('.send-btn').click();
  await expect(page.locator('.chat-messages')).toContainText('基于简历的回答');

  await page.locator('.chat-input').fill('第二问');
  await page.locator('.send-btn').click();
  await expect(page.locator('.chat-messages')).toContainText('第二问');

  const toolRows = page.locator('.tool-row');
  await expect(toolRows).toHaveCount(2);
  await expect(toolRows.nth(0).locator('.tool-chip.done')).toHaveCount(1);
  await expect(toolRows.nth(1).locator('.tool-chip.done')).toHaveCount(1);
  await expect(toolRows.nth(0)).toContainText('resume.json');
  await expect(toolRows.nth(1)).toContainText('resume.json');
});

test('013-04: chat 端点始终返回 SSE 格式', async () => {
  const response = await callChat('你好');
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/event-stream');
  const body = await response.text();
  expect(body).toContain('data:');
  expect(body).toContain('Candidate Agent');
});

test('013-05: tool-use 流程中 SSE 包含 status、tool_done、delta、done 事件', async () => {
  const response = await callChat('请介绍 Aindexer 的项目细节');
  expect(response.status).toBe(200);
  const body = await response.text();
  expect(body).toContain('"type":"status"');
  expect(body).toContain('"type":"tool_done"');
  expect(body).toContain('"type":"delta"');
  expect(body).toContain('"type":"done"');
});

test('013-05a: provider 提供真实思维链时，/api/chat 会先发 thinking 再发 delta', async () => {
  const response = await callChat('请展示真实思维链');
  expect(response.status).toBe(200);
  const body = await response.text();
  expect(body).toContain('"type":"thinking"');
  expect(body.indexOf('"type":"thinking"')).toBeGreaterThan(-1);
  expect(body.indexOf('"type":"delta"')).toBeGreaterThan(-1);
  expect(body.indexOf('"type":"thinking"')).toBeLessThan(body.indexOf('"type":"delta"'));
});

// ─────────────────────────────
// Issue 017: Agent Turn 记录 + JD 类型归类 + Tool Trace 摘要
// ─────────────────────────────

test('017-01: 普通提问成功后写入一条 agent_turn', async () => {
  const fakeTurnStore = new FakeAgentTurnStore();
  const response = await onRequestPost({
    request: new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorUuid: 'test-uuid-017',
        agentSessionId: 'test-session-017',
        messages: [{ role: 'user', content: '你好' }],
      }),
    }),
    env: { ACTIVE_PROVIDER: 'test', AGENT_TURN_STORE: fakeTurnStore },
  } as never);
  await response.text();
  expect(response.status).toBe(200);
  expect(fakeTurnStore.records).toHaveLength(1);
  expect(fakeTurnStore.records[0].visitorUuid).toBe('test-uuid-017');
  expect(fakeTurnStore.records[0].agentSessionId).toBe('test-session-017');
  expect(fakeTurnStore.records[0].userMessage).toBe('你好');
  expect(fakeTurnStore.records[0].turnType).toBe('chat');
});

test('017-02: JD 粘贴分析被记录为独立 turn_type', async () => {
  const fakeTurnStore = new FakeAgentTurnStore();
  const response = await onRequestPost({
    request: new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorUuid: 'test-uuid-017b',
        agentSessionId: 'test-session-017b',
        turnType: 'jd_analysis',
        messages: [{ role: 'user', content: '请基于以下岗位描述分析候选人：需要 AI Agent 工程师' }],
      }),
    }),
    env: { ACTIVE_PROVIDER: 'test', AGENT_TURN_STORE: fakeTurnStore },
  } as never);
  await response.text();
  expect(response.status).toBe(200);
  expect(fakeTurnStore.records).toHaveLength(1);
  expect(fakeTurnStore.records[0].turnType).toBe('jd_analysis');
});

test('017-03: Tool Trace 只保存摘要，不保存完整工具返回内容', async () => {
  const fakeTurnStore = new FakeAgentTurnStore();
  const response = await onRequestPost({
    request: new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorUuid: 'test-uuid-017c',
        agentSessionId: 'test-session-017c',
        messages: [{ role: 'user', content: '请介绍 Aindexer 的项目细节' }],
      }),
    }),
    env: { ACTIVE_PROVIDER: 'test', AGENT_TURN_STORE: fakeTurnStore },
  } as never);
  const body = await response.text();
  expect(response.status).toBe(200);
  expect(fakeTurnStore.records).toHaveLength(1);
  const trace = fakeTurnStore.records[0].toolTrace;
  expect(trace).toBeDefined();
  expect(JSON.stringify(trace)).not.toContain('本地化 AI 工作台');
});

test('017-04: D1 写入失败时 SSE 回答仍成功', async () => {
  const failingStore: { insertTurn: () => Promise<void> } = {
    async insertTurn() {
      throw new Error('D1 unavailable');
    },
  };
  const response = await onRequestPost({
    request: new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorUuid: 'test-uuid-017d',
        agentSessionId: 'test-session-017d',
        messages: [{ role: 'user', content: '你好' }],
      }),
    }),
    env: { ACTIVE_PROVIDER: 'test', AGENT_TURN_STORE: failingStore },
  } as never);
  const body = await response.text();
  expect(response.status).toBe(200);
  expect(body).toContain('data:');
  expect(body).toContain('Candidate Agent');
});

// ─────────────────────────────
// Issue 018: Agent Turn 限频 + 静默退化
// ─────────────────────────────

test('018-01: 同一 visitorUuid 超过每小时 20 次后，第 21 次命中限频', async () => {
  const fakeRateLimit = new FakeRateLimitStore();
  for (let i = 0; i < 20; i++) {
    await fakeRateLimit.checkAndIncrement('test-uuid-018');
  }
  const response = await onRequestPost({
    request: new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorUuid: 'test-uuid-018',
        agentSessionId: 'test-session-018',
        messages: [{ role: 'user', content: '你好' }],
      }),
    }),
    env: { ACTIVE_PROVIDER: 'test', RATE_LIMIT_STORE: fakeRateLimit },
  } as never);
  const body = await response.text();
  expect(response.status).toBe(200);
  expect(body).toContain('已达上限');
});

test('018-02: 全站超过每天 200 次后命中全局限频', async () => {
  const fakeRateLimit = new FakeRateLimitStore();
  fakeRateLimit.globalLimit = 1;
  await fakeRateLimit.checkAndIncrement('filler-uuid');
  const response = await onRequestPost({
    request: new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorUuid: 'test-uuid-018b',
        agentSessionId: 'test-session-018b',
        messages: [{ role: 'user', content: '你好' }],
      }),
    }),
    env: { ACTIVE_PROVIDER: 'test', RATE_LIMIT_STORE: fakeRateLimit },
  } as never);
  const body = await response.text();
  expect(response.status).toBe(200);
  expect(body).toContain('已达上限');
});

test('018-03: 限频计数单位采用 Agent Turn，多轮 tool-use 只算 1 次', async () => {
  const fakeRateLimit = new FakeRateLimitStore();
  const fakeTurnStore = new FakeAgentTurnStore();
  const response = await onRequestPost({
    request: new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorUuid: 'test-uuid-018c',
        agentSessionId: 'test-session-018c',
        messages: [{ role: 'user', content: '请介绍 Aindexer 的项目细节' }],
      }),
    }),
    env: {
      ACTIVE_PROVIDER: 'test',
      RATE_LIMIT_STORE: fakeRateLimit,
      AGENT_TURN_STORE: fakeTurnStore,
    },
  } as never);
  await response.text();
  expect(fakeRateLimit.uuidCounts.get('test-uuid-018c')).toBe(1);
  expect(fakeRateLimit.globalCount).toBe(1);
});

test('018-04: D1 不可用时限频退化，Agent 主链路仍可回答', async () => {
  const failingRateLimit: { checkAndIncrement: () => Promise<{ allowed: boolean }> } = {
    async checkAndIncrement() {
      throw new Error('D1 unavailable');
    },
  };
  const response = await onRequestPost({
    request: new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorUuid: 'test-uuid-018d',
        agentSessionId: 'test-session-018d',
        messages: [{ role: 'user', content: '你好' }],
      }),
    }),
    env: { ACTIVE_PROVIDER: 'test', RATE_LIMIT_STORE: failingRateLimit },
  } as never);
  const body = await response.text();
  expect(response.status).toBe(200);
  expect(body).toContain('data:');
  expect(body).toContain('Candidate Agent');
});

test('018-05: 跨小时后 UUID 限频计数重置', async () => {
  const fakeRateLimit = new FakeRateLimitStore();
  fakeRateLimit.uuidLimit = 2;
  for (let i = 0; i < 2; i++) {
    await fakeRateLimit.checkAndIncrement('test-uuid-window');
  }
  let result = await fakeRateLimit.checkAndIncrement('test-uuid-window');
  expect(result.allowed).toBe(false);
  expect(result.reason).toBe('uuid_limit');

  fakeRateLimit.advanceTime(61 * 60 * 1000);
  result = await fakeRateLimit.checkAndIncrement('test-uuid-window');
  expect(result.allowed).toBe(true);
});

test('018-06: 跨天后全局限频计数重置', async () => {
  const fakeRateLimit = new FakeRateLimitStore();
  fakeRateLimit.globalLimit = 2;
  for (let i = 0; i < 2; i++) {
    await fakeRateLimit.checkAndIncrement('test-uuid-day-a');
  }
  let result = await fakeRateLimit.checkAndIncrement('test-uuid-day-b');
  expect(result.allowed).toBe(false);
  expect(result.reason).toBe('global_limit');

  fakeRateLimit.advanceTime(25 * 60 * 60 * 1000);
  result = await fakeRateLimit.checkAndIncrement('test-uuid-day-c');
  expect(result.allowed).toBe(true);
});

// ─────────────────────────────
// Issue 035: 同页多轮对话主链路（基线）
// ─────────────────────────────

test('035-01: 同一页第二次提问时，请求体会带上前一轮正式对话历史', async ({ page }) => {
  const requests: Array<{ messages: Array<{ role: string; content: string }> }> = [];

  await page.route('**/api/chat', async (route) => {
    requests.push(route.request().postDataJSON() as { messages: Array<{ role: string; content: string }> });
    const turn = requests.length;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: turn === 1 ? '第一轮回答' : '第二轮回答' }),
    });
  });

  await page.goto('/agent/');

  await page.locator('.chat-input').fill('第一问');
  await page.locator('.send-btn').click();
  await expect(page.locator('.chat-messages')).toContainText('第一轮回答');

  await page.locator('.chat-input').fill('第二问');
  await page.locator('.send-btn').click();
  await expect(page.locator('.chat-messages')).toContainText('第二轮回答');

  expect(requests).toHaveLength(2);
  expect(requests[1].messages).toEqual([
    { role: 'user', content: '第一问' },
    { role: 'assistant', content: '第一轮回答' },
    { role: 'user', content: '第二问' },
  ]);
});

test('035-02: 第一轮是 SSE 回答时，第二次提问仍会带上前一轮正式对话历史', async ({ page }) => {
  const requests: Array<{ messages: Array<{ role: string; content: string }> }> = [];

  await page.route('**/api/chat', async (route) => {
    requests.push(route.request().postDataJSON() as { messages: Array<{ role: string; content: string }> });
    const turn = requests.length;
    if (turn === 1) {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: [
          'data: {"type":"delta","content":"第一轮流式回答"}\n\n',
          'data: {"type":"done"}\n\n',
        ].join(''),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: '第二轮回答' }),
    });
  });

  await page.goto('/agent/');

  await page.locator('.chat-input').fill('第一问');
  await page.locator('.send-btn').click();
  await expect(page.locator('.chat-messages')).toContainText('第一轮流式回答');

  await page.locator('.chat-input').fill('第二问');
  await page.locator('.send-btn').click();
  await expect(page.locator('.chat-messages')).toContainText('第二轮回答');

  expect(requests).toHaveLength(2);
  expect(requests[1].messages).toEqual([
    { role: 'user', content: '第一问' },
    { role: 'assistant', content: '第一轮流式回答' },
    { role: 'user', content: '第二问' },
  ]);
});

test('035-03: JD 分析会带上当前页已有的正式对话历史，而不是独立成一次性分析', async ({ page }) => {
  const requests: Array<{ messages: Array<{ role: string; content: string }> }> = [];

  await page.route('**/api/chat', async (route) => {
    requests.push(route.request().postDataJSON() as { messages: Array<{ role: string; content: string }> });
    const turn = requests.length;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: turn === 1 ? '第一轮回答' : 'JD 分析结果' }),
    });
  });

  await page.goto('/agent/');

  await page.locator('.chat-input').fill('先介绍一下候选人');
  await page.locator('.send-btn').click();
  await expect(page.locator('.chat-messages')).toContainText('第一轮回答');

  await page.getByRole('button', { name: 'JD 分析' }).click();
  await page.locator('.jd-textarea').fill('需要 AI Agent 产品工程师');
  await page.locator('.send-btn').click();
  await expect(page.locator('.chat-messages')).toContainText('JD 分析结果');

  expect(requests).toHaveLength(2);
  expect(requests[1].messages).toEqual([
    { role: 'user', content: '先介绍一下候选人' },
    { role: 'assistant', content: '第一轮回答' },
    { role: 'user', content: '请基于以下岗位描述分析候选人的匹配点、风险点和建议追问：\n\n需要 AI Agent 产品工程师' },
  ]);
});

test('035-04: 刷新页面后，新的提问作为新的 Agent Session 开始，不继承刷新前历史', async ({ page }) => {
  const requests: Array<{ messages: Array<{ role: string; content: string }> }> = [];

  await page.route('**/api/chat', async (route) => {
    requests.push(route.request().postDataJSON() as { messages: Array<{ role: string; content: string }> });
    const turn = requests.length;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: turn === 1 ? '刷新前回答' : '刷新后回答' }),
    });
  });

  await page.goto('/agent/');

  await page.locator('.chat-input').fill('刷新前问题');
  await page.locator('.send-btn').click();
  await expect(page.locator('.chat-messages')).toContainText('刷新前回答');

  await page.reload();

  await page.locator('.chat-input').fill('刷新后问题');
  await page.locator('.send-btn').click();
  await expect(page.locator('.chat-messages')).toContainText('刷新后回答');

  expect(requests).toHaveLength(2);
  expect(requests[1].messages).toEqual([
    { role: 'user', content: '刷新后问题' },
  ]);
});

// ─────────────────────────────
// Issue 036: 思考模式与工具调用的协议级历史回放
// ─────────────────────────────

test('036-01: /api/chat 在一轮工具调用完成后额外返回 canonical turn 事件', async () => {
  const response = await callChat('请介绍 Aindexer 的项目细节');
  expect(response.status).toBe(200);

  const body = await response.text();
  const events = extractEventsFromSse(body);
  const canonicalTurn = events.find((event) => event.type === 'canonical_turn') as
    | { type: string; messages?: Array<Record<string, unknown>> }
    | undefined;

  expect(canonicalTurn).toBeDefined();
  expect(canonicalTurn?.messages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        role: 'assistant',
        tool_calls: expect.any(Array),
      }),
      expect.objectContaining({
        role: 'tool',
        name: 'read_file',
        tool_call_id: 'fake-read-aindexer',
      }),
      expect.objectContaining({
        role: 'assistant',
        content: expect.stringContaining('Aindexer 是面向科研文献的本地化 AI 工作台'),
      }),
    ]),
  );
});

test('036-02: 当前页收到 canonical turn 后，下一轮请求会回放 assistant reasoning 与 tool 消息', async ({ page }) => {
  const requests: Array<{ messages: Array<Record<string, unknown>> }> = [];

  await page.route('**/api/chat', async (route) => {
    requests.push(route.request().postDataJSON() as { messages: Array<Record<string, unknown>> });
    const turn = requests.length;
    if (turn === 1) {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: [
          'data: {"type":"status","content":"正在查阅 resume.json"}\n\n',
          'data: {"type":"tool_done","content":"resume.json"}\n\n',
          'data: {"type":"thinking","content":"我先查阅简历，再组织正式回答。"}\n\n',
          'data: {"type":"delta","content":"基于简历的正式回答"}\n\n',
          'data: {"type":"canonical_turn","messages":[{"role":"assistant","content":"","reasoning_content":"我先查阅简历，再组织正式回答。","tool_calls":[{"id":"tool-1","function":{"name":"read_file","arguments":"{\\"file\\":\\"resume.json\\"}"}}]},{"role":"tool","name":"read_file","tool_call_id":"tool-1","content":"resume full content"},{"role":"assistant","content":"基于简历的正式回答"}]}\n\n',
          'data: {"type":"done"}\n\n',
        ].join(''),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: '第二轮回答' }),
    });
  });

  await page.goto('/agent/');

  await page.locator('.chat-input').fill('第一问');
  await page.locator('.send-btn').click();
  await expect(page.locator('.chat-messages')).toContainText('基于简历的正式回答');

  await page.locator('.chat-input').fill('第二问');
  await page.locator('.send-btn').click();
  await expect(page.locator('.chat-messages')).toContainText('第二轮回答');

  expect(requests).toHaveLength(2);
  expect(requests[1].messages).toEqual([
    { role: 'user', content: '第一问' },
    {
      role: 'assistant',
      content: '',
      reasoning_content: '我先查阅简历，再组织正式回答。',
      tool_calls: [
        {
          id: 'tool-1',
          function: { name: 'read_file', arguments: '{"file":"resume.json"}' },
        },
      ],
    },
    { role: 'tool', name: 'read_file', tool_call_id: 'tool-1', content: 'resume full content' },
    { role: 'assistant', content: '基于简历的正式回答' },
    { role: 'user', content: '第二问' },
  ]);
});
