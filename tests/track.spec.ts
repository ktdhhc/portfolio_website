import { test, expect } from '@playwright/test';
import { onRequestPost } from '../functions/api/track';
import { FakeBehaviorEventStore } from '../functions/api/_store/fake';
import type { BehaviorEventStore } from '../functions/api/_store/types';

// ─────────────────────────────
// Issue 015: Visitor UUID + Agent Session + agent_open Behavior Event
// ─────────────────────────────

test('015-01: POST /api/track 接收 agent_open 事件并返回成功', async () => {
  const response = await onRequestPost({
    request: new Request('http://localhost/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorUuid: 'test-uuid-001',
        events: [{ type: 'agent_open', agentSessionId: 'test-session-001' }],
      }),
    }),
    env: { ACTIVE_PROVIDER: 'test' },
  } as never);
  expect(response.status).toBe(200);
});

test('015-02: agent_open 事件持久化后可关联 Visitor UUID 与 Agent Session', async () => {
  const fakeStore = new FakeBehaviorEventStore();
  const response = await onRequestPost({
    request: new Request('http://localhost/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorUuid: 'test-uuid-002',
        events: [{ type: 'agent_open', agentSessionId: 'test-session-002' }],
      }),
    }),
    env: { BEHAVIOR_EVENT_STORE: fakeStore },
  } as never);
  expect(response.status).toBe(200);
  expect(fakeStore.records).toHaveLength(1);
  expect(fakeStore.records[0].visitorUuid).toBe('test-uuid-002');
  expect(fakeStore.records[0].agentSessionId).toBe('test-session-002');
  expect(fakeStore.records[0].eventType).toBe('agent_open');
});

test('015-03: store 抛出异常时 /api/track 仍返回 200（D1 退化）', async () => {
  const failingStore: BehaviorEventStore = {
    async insertEvents() {
      throw new Error('D1 unavailable');
    },
    async listEvents() {
      return [];
    },
    async listWriteFailures() {
      return [];
    },
  };
  const response = await onRequestPost({
    request: new Request('http://localhost/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorUuid: 'test-uuid-003',
        events: [{ type: 'agent_open', agentSessionId: 'test-session-003' }],
      }),
    }),
    env: { BEHAVIOR_EVENT_STORE: failingStore },
  } as never);
  expect(response.status).toBe(200);
});

// ─────────────────────────────
// 页面级 E2E
// ─────────────────────────────

test('015-04: 进入 /agent 页面时会发送 agent_open 事件', async ({ page }) => {
  const trackRequests: string[] = [];
  await page.route('**/api/track', async (route) => {
    trackRequests.push(route.request().postData() ?? '');
    await route.fulfill({ status: 200 });
  });
  await page.goto('/agent/');
  await expect.poll(() => trackRequests.some((r) => {
    try { return JSON.parse(r).events[0].type === 'agent_open'; } catch { return false; }
  })).toBe(true);
  const agentOpenBody = JSON.parse(trackRequests.find((r) => {
    try { return JSON.parse(r).events[0].type === 'agent_open'; } catch { return false; }
  }) ?? '{}');
  expect(agentOpenBody.visitorUuid).toBeTruthy();
  expect(agentOpenBody.events[0].agentSessionId).toBeTruthy();
});

test('015-05: 刷新 /agent 后复用同一个 visitorUuid，但生成新的 agentSessionId', async ({ page }) => {
  const trackRequests: string[] = [];
  await page.route('**/api/track', async (route) => {
    trackRequests.push(route.request().postData() ?? '');
    await route.fulfill({ status: 200 });
  });
  await page.goto('/agent/');
  await expect.poll(() => trackRequests.some((r) => {
    try { return JSON.parse(r).events[0].type === 'agent_open'; } catch { return false; }
  })).toBe(true);
  await page.reload();
  await expect.poll(() => trackRequests.filter((r) => {
    try { return JSON.parse(r).events[0].type === 'agent_open'; } catch { return false; }
  }).length).toBeGreaterThanOrEqual(2);
  const agentOpenRequests = trackRequests.filter((r) => {
    try { return JSON.parse(r).events[0].type === 'agent_open'; } catch { return false; }
  });
  const firstBody = JSON.parse(agentOpenRequests[0]);
  const secondBody = JSON.parse(agentOpenRequests[1]);
  expect(firstBody.visitorUuid).toBe(secondBody.visitorUuid);
  expect(firstBody.events[0].agentSessionId).not.toBe(secondBody.events[0].agentSessionId);
});

test('015-06: /api/track 失败时 /agent 页面仍可访问和提问，无额外错误提示', async ({ page }) => {
  await page.route('**/api/track', async (route) => {
    await route.fulfill({ status: 500 });
  });
  await page.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: [
        'data: {"type":"delta","content":"正常回答"}\n\n',
        'data: {"type":"done"}\n\n',
      ].join(''),
    });
  });
  await page.goto('/agent/');
  await expect(page.locator('.chat-input')).toBeVisible();
  await page.locator('.chat-input').fill('你好');
  await page.locator('.send-btn').click();
  await expect(page.locator('.chat-messages')).toContainText('正常回答');
  await expect(page.locator('.chat-messages')).not.toContainText('记录');
});

// ─────────────────────────────
// Issue 016: 公共页面 Behavior Event 采集
// ─────────────────────────────

test('016-01: 访问公共页面时会发送 page_view 事件', async ({ page }) => {
  const trackRequests: string[] = [];
  await page.route('**/api/track', async (route) => {
    trackRequests.push(route.request().postData() ?? '');
    await route.fulfill({ status: 200 });
  });
  await page.goto('/');
  await expect.poll(() => trackRequests.length).toBeGreaterThanOrEqual(1);
  const body = JSON.parse(trackRequests[0]);
  expect(body.visitorUuid).toBeTruthy();
  expect(body.events[0].type).toBe('page_view');
  expect(body.events[0].path).toBeTruthy();
});

test('016-02: 点击 PDF 下载时发送 pdf_download 事件', async ({ page }) => {
  const trackRequests: string[] = [];
  await page.route('**/api/track', async (route) => {
    trackRequests.push(route.request().postData() ?? '');
    await route.fulfill({ status: 200 });
  });
  await page.goto('/resume/');
  trackRequests.length = 0;
  await page.locator('a[href*="resume.pdf"]').first().dispatchEvent('click');
  await expect.poll(() => trackRequests.length).toBeGreaterThanOrEqual(1);
  const hasPdfDownload = trackRequests.some((r) => {
    const body = JSON.parse(r);
    return body.events[0].type === 'pdf_download';
  });
  expect(hasPdfDownload).toBe(true);
});

test('016-03: 点击项目详情链接时发送 project_click 事件', async ({ page }) => {
  const trackRequests: string[] = [];
  await page.route('**/api/track', async (route) => {
    trackRequests.push(route.request().postData() ?? '');
    await route.fulfill({ status: 200 });
  });
  await page.goto('/');
  trackRequests.length = 0;
  await page.locator('a[href*="/projects/"]').first().dispatchEvent('click');
  await expect.poll(() => trackRequests.length).toBeGreaterThanOrEqual(1);
  const hasProjectClick = trackRequests.some((r) => {
    const body = JSON.parse(r);
    return body.events[0].type === 'project_click';
  });
  expect(hasProjectClick).toBe(true);
});

test('016-04: 点击外链时发送 external_click 事件', async ({ page }) => {
  const trackRequests: string[] = [];
  await page.route('**/api/track', async (route) => {
    trackRequests.push(route.request().postData() ?? '');
    await route.fulfill({ status: 200 });
  });
  await page.goto('/projects/aindexer/');
  trackRequests.length = 0;
  await page.locator('a[target="_blank"]').first().dispatchEvent('click');
  await expect.poll(() => trackRequests.length).toBeGreaterThanOrEqual(1);
  const hasExternalClick = trackRequests.some((r) => {
    const body = JSON.parse(r);
    return body.events[0].type === 'external_click';
  });
  expect(hasExternalClick).toBe(true);
});

test('016-05: 现有导航和下载行为不被记录逻辑阻断', async ({ page }) => {
  await page.route('**/api/track', async (route) => {
    await route.fulfill({ status: 500 });
  });
  await page.goto('/projects/');
  await expect(page.locator('body')).toBeVisible();
  const projectLink = page.locator('.project-card a[href*="/projects/"]').first();
  await projectLink.click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/?$/);
});
