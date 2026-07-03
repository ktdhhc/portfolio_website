import { expect, test } from '@playwright/test';
import { stubNonOverviewStats, stubTrack } from './admin-page.helpers';

async function stubAdminShell(page: Parameters<typeof test>[0]['page']): Promise<void> {
  await stubTrack(page);
  await stubNonOverviewStats(page);
  await page.route('**/api/admin/auth', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.route('**/api/admin/stats/overview**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          metrics: {
            pageViews: { current: 9, previous: 4 },
            pdfDownloads: { current: 2, previous: 1 },
            agentTurns: { current: 5, previous: 2 },
            jdAnalyses: { current: 1, previous: 0 },
            avgPageDurationMs: { current: 90000, previous: 45000 },
            agentFailures: { current: 1, previous: 1 },
          },
        },
      }),
    });
  });
}

test('024-05: logs 模块渲染会话列表字段、会话总数与预留按钮', async ({ page }) => {
  await stubAdminShell(page);
  await page.route('**/api/admin/logs**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          items: [
            {
              id: 'session-2',
              visitorUuidShort: 'visitor-',
              agentSessionIdShort: 'session-',
              startedAt: '2026-06-28T10:00:00.000Z',
              lastTurnAt: '2026-06-28T11:00:00.000Z',
              turnCount: 2,
              latestUserMessage: '这是被截断后的列表问题内容'.padEnd(80, '问'),
            },
          ],
          total: 3,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        },
      }),
    });
  });

  await page.goto('/admin/');
  await page.getByLabel('管理员 Token').fill('secret-admin-token');
  await page.getByRole('button', { name: '进入面板' }).click();

  await expect(page.locator('[data-module="logs"]')).toContainText('共 3 段会话');
  await expect(page.locator('[data-log-row="session-2"]')).toContainText('2026-06-28 19:00');
  await expect(page.locator('[data-log-row="session-2"]')).toContainText('2 轮');
  await expect(page.locator('[data-log-row="session-2"]')).toContainText('这是被截断后的列表问题内容');
  await expect(page.locator('[data-log-row="session-2"]')).not.toContainText('assistantAnswer');
  await expect(page.getByRole('button', { name: '导出 CSV' })).toBeVisible();
  await expect(page.getByRole('button', { name: '导出 JSON' })).toBeVisible();
  await expect(page.getByRole('button', { name: '按时间范围删除' })).toBeVisible();
  await expect(page.getByRole('button', { name: '清空全部' })).toBeVisible();
});

test('024-06: logs 分页与当前 period 同步，切换 period 时回到第一页', async ({ page }) => {
  const requests: string[] = [];

  await stubAdminShell(page);
  await page.route('**/api/admin/logs**', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.search);
    const period = url.searchParams.get('period');
    const pageNumber = url.searchParams.get('page');
    const label = `${period}-${pageNumber}`;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          items: [{
            id: label,
            visitorUuidShort: 'visitor-',
            agentSessionIdShort: label,
            startedAt: '2026-06-28T10:00:00.000Z',
            lastTurnAt: '2026-06-28T11:00:00.000Z',
            turnCount: 1,
            latestUserMessage: label,
          }],
          total: 21,
          page: Number(pageNumber ?? '1'),
          pageSize: 20,
          totalPages: 2,
        },
      }),
    });
  });

  await page.goto('/admin/');
  await page.getByLabel('管理员 Token').fill('secret-admin-token');
  await page.getByRole('button', { name: '进入面板' }).click();

  await expect(page.locator('[data-log-row="week-1"]')).toBeVisible();
  await page.getByRole('button', { name: '下一页' }).click();
  await expect(page.locator('[data-log-row="week-2"]')).toBeVisible();
  await page.getByRole('button', { name: '本月' }).click();
  await expect(page.locator('[data-log-row="month-1"]')).toBeVisible();
  expect(requests).toEqual(expect.arrayContaining(['?period=week&page=1&pageSize=20', '?period=week&page=2&pageSize=20', '?period=month&page=1&pageSize=20']));
});

test('024-07: 点击 session turn 后展示详情字段集与 toolTrace 摘要', async ({ page }) => {
  await stubAdminShell(page);
  await page.route('**/api/admin/logs**', async (route) => {
    const url = new URL(route.request().url());
    const sessionId = url.searchParams.get('sessionId');
    const id = url.searchParams.get('id');

    if (sessionId === 'session-2') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            session: {
              id: 'session-2',
              visitorUuidShort: '12345678',
              agentSessionIdShort: '87654321',
              startedAt: '2026-06-28T10:00:00.000Z',
              lastTurnAt: '2026-06-28T11:00:00.000Z',
              turnCount: 1,
            },
            turns: [{ id: '2', createdAt: '2026-06-28T11:00:00.000Z', userMessage: '列表问题', turnType: 'chat', answerStatus: 'success' }],
          },
        }),
      });
      return;
    }

    if (id === '2') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            item: {
              id: '2',
              createdAt: '2026-06-28T11:00:00.000Z',
              userMessage: '完整用户问题',
              assistantAnswer: '完整回答',
              turnType: 'chat',
              answerStatus: 'success',
              durationMs: 321,
              toolTraceSummary: {
                toolCalls: 2,
                files: ['resume.json', 'projects/aindexer/index.md'],
              },
              visitorUuidShort: '12345678',
              agentSessionIdShort: '87654321',
            },
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          items: [{
            id: 'session-2',
            visitorUuidShort: '12345678',
            agentSessionIdShort: '87654321',
            startedAt: '2026-06-28T10:00:00.000Z',
            lastTurnAt: '2026-06-28T11:00:00.000Z',
            turnCount: 1,
            latestUserMessage: '列表问题',
          }],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        },
      }),
    });
  });

  await page.goto('/admin/');
  await page.getByLabel('管理员 Token').fill('secret-admin-token');
  await page.getByRole('button', { name: '进入面板' }).click();
  await page.locator('[data-log-row="session-2"]').click();
  await page.locator('[data-session-turn="2"]').click();

  await expect(page.locator('[data-log-detail]')).toContainText('完整用户问题');
  await expect(page.locator('[data-log-detail]')).toContainText('完整回答');
  await expect(page.locator('[data-log-detail]')).toContainText('321');
  await expect(page.locator('[data-log-detail]')).toContainText('toolCalls 2');
  await expect(page.locator('[data-log-detail]')).toContainText('resume.json');
  await expect(page.locator('[data-log-detail]')).toContainText('12345678');
  await expect(page.locator('[data-log-detail]')).toContainText('87654321');
});

test('024-08: logs 模块降级时只在本模块显示暂不可用', async ({ page }) => {
  await stubAdminShell(page);
  await page.route('**/api/admin/logs**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'db_unavailable' }) });
  });

  await page.goto('/admin/');
  await page.getByLabel('管理员 Token').fill('secret-admin-token');
  await page.getByRole('button', { name: '进入面板' }).click();

  await expect(page.locator('[data-module="logs"]')).toContainText('暂不可用');
  await expect(page.locator('[data-module="overview"]')).toContainText('9');
});

test('037-02: logs 顶层按 Agent Session 渲染会话行，而不是单条 turn 行', async ({ page }) => {
  await stubAdminShell(page);
  await page.route('**/api/admin/logs**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          items: [
            {
              id: 'session-22222222',
              visitorUuidShort: 'visitor-',
              agentSessionIdShort: 'session-',
              startedAt: '2026-06-28T11:30:00.000Z',
              lastTurnAt: '2026-06-28T11:30:00.000Z',
              turnCount: 1,
              latestUserMessage: '第二个会话的唯一问题',
            },
          ],
          total: 2,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        },
      }),
    });
  });
  await page.goto('/admin/');
  await page.getByLabel('管理员 Token').fill('secret-admin-token');
  await page.getByRole('button', { name: '进入面板' }).click();

  await expect(page.locator('[data-module="logs"]')).toContainText('共 2 段会话');
  await expect(page.locator('[data-log-row="session-22222222"]')).toContainText('第二个会话的唯一问题');
  await expect(page.locator('[data-log-row="session-22222222"]')).toContainText('1 轮');
  await expect(page.locator('[data-log-row="session-22222222"]')).not.toContainText('success');
});

test('037-03: logs 顶层会话时间统一按 Asia/Shanghai 显示，而不是原始 ISO 串', async ({ page }) => {
  await stubAdminShell(page);
  await page.route('**/api/admin/logs**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          items: [
            {
              id: 'session-33333333',
              visitorUuidShort: 'visitor-',
              agentSessionIdShort: 'session-',
              startedAt: '2026-06-28T11:30:00.000Z',
              lastTurnAt: '2026-06-28T11:30:00.000Z',
              turnCount: 1,
              latestUserMessage: '看时间显示',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        },
      }),
    });
  });
  await page.goto('/admin/');
  await page.getByLabel('管理员 Token').fill('secret-admin-token');
  await page.getByRole('button', { name: '进入面板' }).click();

  await expect(page.locator('[data-log-row="session-33333333"]')).toContainText('2026-06-28 19:30');
  await expect(page.locator('[data-log-row="session-33333333"]')).not.toContainText('2026-06-28T11:30:00.000Z');
});

test('038-02: 点击会话行后，详情区先显示会话摘要与该会话下的 turn 列表', async ({ page }) => {
  await stubAdminShell(page);
  await page.route('**/api/admin/logs?period=week&page=1&pageSize=20', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          items: [
            {
              id: 'session-11111111',
              visitorUuidShort: 'visitor-',
              agentSessionIdShort: 'session-',
              startedAt: '2026-06-28T10:00:00.000Z',
              lastTurnAt: '2026-06-28T11:00:00.000Z',
              turnCount: 2,
              latestUserMessage: '第一个会话的第二问',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        },
      }),
    });
  });
  await page.route('**/api/admin/logs?period=week&sessionId=session-11111111', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          session: {
            id: 'session-11111111',
            visitorUuidShort: 'visitor-',
            agentSessionIdShort: 'session-',
            startedAt: '2026-06-28T10:00:00.000Z',
            lastTurnAt: '2026-06-28T11:00:00.000Z',
            turnCount: 2,
          },
          turns: [
            { id: '1', createdAt: '2026-06-28T10:00:00.000Z', userMessage: '第一个会话的第一问', turnType: 'chat', answerStatus: 'success' },
            { id: '2', createdAt: '2026-06-28T11:00:00.000Z', userMessage: '第一个会话的第二问', turnType: 'jd_analysis', answerStatus: 'degraded' },
          ],
        },
      }),
    });
  });

  await page.goto('/admin/');
  await page.getByLabel('管理员 Token').fill('secret-admin-token');
  await page.getByRole('button', { name: '进入面板' }).click();
  await page.locator('[data-log-row="session-11111111"]').click();

  await expect(page.locator('[data-log-detail]')).toContainText('visitor-');
  await expect(page.locator('[data-log-detail]')).toContainText('session-');
  await expect(page.locator('[data-log-detail]')).toContainText('2');
  await expect(page.locator('[data-session-turn="1"]')).toContainText('第一个会话的第一问');
  await expect(page.locator('[data-session-turn="2"]')).toContainText('第一个会话的第二问');
});
