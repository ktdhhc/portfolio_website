import { test, expect } from '@playwright/test';
import { onRequestPost } from '../functions/api/chat';

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
  await expect(page.locator('.chat-messages')).toContainText('Agent 服务暂时不可用');
  await expect(page.locator('.chat-messages')).toContainText('查看静态简历');
});

test('010-07: 首页 Agent 入口会跳转到 /agent', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '与 Agent 对话' }).click();
  await expect(page).toHaveURL(/\/agent\/?$/);
});

test('010-08: 首页 Agent CTA 开始对话会跳转到 /agent', async ({ page }) => {
  await page.goto('/');
  await page.locator('section#agent').getByRole('link', { name: '开始对话' }).click();
  await expect(page).toHaveURL(/\/agent\/?$/);
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

test('011-04: read_file 拒绝读取白名单外文件', async () => {
  const response = await callChat('请读取非法文件');
  expect(response.status).toBe(200);
  const body = await response.text();
  const error = extractErrorFromSse(body);
  expect(error).toContain('not available to Candidate Agent');
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
