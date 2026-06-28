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

test('024-05: logs 模块渲染列表字段、记录总数与预留按钮', async ({ page }) => {
  await stubAdminShell(page);
  await page.route('**/api/admin/logs**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          items: [
            { id: '2', createdAt: '2026-06-28T11:00:00.000Z', userMessage: '这是被截断后的列表问题内容'.padEnd(80, '问'), turnType: 'jd_analysis', answerStatus: 'degraded' },
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

  await expect(page.locator('[data-module="logs"]')).toContainText('共 3 条记录');
  await expect(page.locator('[data-log-row="2"]')).toContainText('2026-06-28T11:00:00.000Z');
  await expect(page.locator('[data-log-row="2"]')).toContainText('jd_analysis');
  await expect(page.locator('[data-log-row="2"]')).toContainText('degraded');
  await expect(page.locator('[data-log-row="2"]')).not.toContainText('assistantAnswer');
  await expect(page.getByRole('button', { name: '导出' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '清理' })).toBeDisabled();
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
          items: [{ id: label, createdAt: '2026-06-28T11:00:00.000Z', userMessage: label, turnType: 'chat', answerStatus: 'success' }],
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

test('024-07: 点击 logs 行后展示详情字段集与 toolTrace 摘要', async ({ page }) => {
  await stubAdminShell(page);
  await page.route('**/api/admin/logs?period=week&page=1&pageSize=20', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          items: [{ id: '2', createdAt: '2026-06-28T11:00:00.000Z', userMessage: '列表问题', turnType: 'chat', answerStatus: 'success' }],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        },
      }),
    });
  });
  await page.route('**/api/admin/logs?period=week&id=2', async (route) => {
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
  });

  await page.goto('/admin/');
  await page.getByLabel('管理员 Token').fill('secret-admin-token');
  await page.getByRole('button', { name: '进入面板' }).click();
  await page.locator('[data-log-row="2"]').click();

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
