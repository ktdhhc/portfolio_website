import { expect, test } from '@playwright/test';
import { type OverviewPayload, stubNonOverviewStats, stubTrack } from './admin-page.helpers';

test('023-02: 登录成功后持久化 token 并渲染总览 stat 卡', async ({ page }) => {
  const overview: OverviewPayload = {
    ok: true,
    data: {
      metrics: {
        pageViews: { current: 1284, previous: 1146 },
        pdfDownloads: { current: 47, previous: 43 },
        agentTurns: { current: 326, previous: 263 },
        jdAnalyses: { current: 18, previous: 18 },
        avgPageDurationMs: { current: 222000, previous: 210000 },
        agentFailures: { current: 5, previous: 3 },
      },
    },
  };

  await stubTrack(page);
  await stubNonOverviewStats(page);
  await page.route('**/api/admin/auth', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({ token: 'secret-admin-token' });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.route('**/api/admin/stats/overview**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(overview) });
  });

  await page.goto('/admin/');
  await page.getByLabel('管理员 Token').fill('secret-admin-token');
  await page.getByRole('button', { name: '进入面板' }).click();

  await expect(page.getByRole('heading', { name: '数据面板' })).toBeVisible();
  await expect(page.locator('[data-metric-card="pageViews"]')).toContainText('1,284');
  await expect(page.locator('[data-metric-card="pdfDownloads"]')).toContainText('47');
  await expect(page.locator('[data-metric-card="agentTurns"]')).toContainText('326');
  await expect(page.locator('[data-metric-card="jdAnalyses"]')).toContainText('18');
  await expect(page.locator('[data-metric-card="avgPageDurationMs"]')).toContainText('3m 42s');
  await expect(page.locator('[data-metric-card="agentFailures"]')).toContainText('5');
  await expect(page.locator('[data-metric-card="pageViews"] .stat-change')).toContainText('较上周');
  await expect(page.locator('[data-metric-card="jdAnalyses"] .stat-change')).toContainText('持平');
  await expect(page.locator('[data-metric-card="agentFailures"] .stat-change')).toHaveClass(/down/);
  await expect(page.evaluate(() => localStorage.getItem('portfolio_admin_token'))).resolves.toBe('secret-admin-token');
});

test('023-04: 时间窗口切换会携带 today|week|month 并刷新总览数据', async ({ page }) => {
  const requestedPeriods: string[] = [];

  await stubTrack(page);
  await stubNonOverviewStats(page);
  await page.route('**/api/admin/auth', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.route('**/api/admin/stats/overview**', async (route) => {
    const period = new URL(route.request().url()).searchParams.get('period') ?? 'missing';
    requestedPeriods.push(period);
    const valuesByPeriod: Record<string, OverviewPayload> = {
      today: { ok: true, data: { metrics: { pageViews: { current: 3, previous: 1 }, pdfDownloads: { current: 1, previous: 0 }, agentTurns: { current: 2, previous: 1 }, jdAnalyses: { current: 1, previous: 0 }, avgPageDurationMs: { current: 61000, previous: 30000 }, agentFailures: { current: 0, previous: 1 } } } },
      week: { ok: true, data: { metrics: { pageViews: { current: 9, previous: 4 }, pdfDownloads: { current: 2, previous: 1 }, agentTurns: { current: 5, previous: 2 }, jdAnalyses: { current: 1, previous: 0 }, avgPageDurationMs: { current: 90000, previous: 45000 }, agentFailures: { current: 1, previous: 1 } } } },
      month: { ok: true, data: { metrics: { pageViews: { current: 30, previous: 15 }, pdfDownloads: { current: 8, previous: 4 }, agentTurns: { current: 11, previous: 7 }, jdAnalyses: { current: 4, previous: 2 }, avgPageDurationMs: { current: 125000, previous: 120000 }, agentFailures: { current: 2, previous: 1 } } } },
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(valuesByPeriod[period]) });
  });

  await page.goto('/admin/');
  await page.getByLabel('管理员 Token').fill('secret-admin-token');
  await page.getByRole('button', { name: '进入面板' }).click();

  await expect(page.locator('[data-metric-card="pageViews"]')).toContainText('9');
  await page.getByRole('button', { name: '今日' }).click();
  await expect(page.locator('[data-metric-card="pageViews"]')).toContainText('3');
  await page.getByRole('button', { name: '本月' }).click();
  await expect(page.locator('[data-metric-card="pageViews"]')).toContainText('30');
  expect(requestedPeriods).toEqual(expect.arrayContaining(['week', 'today', 'month']));
});

test('023-05: 单个 stats 模块降级时只在该模块显示暂不可用', async ({ page }) => {
  await stubTrack(page);
  await stubNonOverviewStats(page, { pages: { ok: false, reason: 'db_unavailable' } });
  await page.route('**/api/admin/auth', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.route('**/api/admin/stats/overview**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: { metrics: { pageViews: { current: 20, previous: 10 }, pdfDownloads: { current: 4, previous: 2 }, agentTurns: { current: 6, previous: 4 }, jdAnalyses: { current: 2, previous: 1 }, avgPageDurationMs: { current: 120000, previous: 60000 }, agentFailures: { current: 1, previous: 1 } } } }),
    });
  });

  await page.goto('/admin/');
  await page.getByLabel('管理员 Token').fill('secret-admin-token');
  await page.getByRole('button', { name: '进入面板' }).click();

  await expect(page.locator('[data-module="overview"]')).toContainText('20');
  await expect(page.locator('[data-module="pages"]')).toContainText('暂不可用');
  await expect(page.locator('[data-module="projects"]')).not.toContainText('暂不可用');
});
