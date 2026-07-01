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

test('029-01: pages 模块渲染当前窗口的热门页面列表而不是占位文案', async ({ page }) => {
  await stubTrack(page);
  await stubNonOverviewStats(page, {
    pages: {
      ok: true,
      data: {
        items: [
          { path: '/', count: 12 },
          { path: '/resume', count: 7 },
        ],
      },
    },
  });
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

  const pagesModule = page.locator('[data-module="pages"]');
  await expect(pagesModule.locator('[data-module-list]')).toBeVisible();
  await expect(pagesModule.locator('[data-module-item="/"]')).toContainText('/');
  await expect(pagesModule.locator('[data-module-item="/"]')).toContainText('12');
  await expect(pagesModule.locator('[data-module-item="/resume"]')).toContainText('/resume');
  await expect(pagesModule.locator('[data-module-item="/resume"]')).toContainText('7');
  await expect(pagesModule).not.toContainText('模块已连接，详情将在后续 issue 完成。');
});

test('029-02: projects、agent-summary 与 issues 模块渲染真实列表', async ({ page }) => {
  await stubTrack(page);
  await stubNonOverviewStats(page, {
    projects: {
      ok: true,
      data: {
        items: [
          { targetId: 'aindexer', count: 9 },
          { targetId: 'memcraft', count: 4 },
        ],
      },
    },
    agentSummary: {
      ok: true,
      data: {
        items: [
          { keyword: 'JD 分析', count: 5 },
          { keyword: '技术栈', count: 3 },
        ],
      },
    },
    issues: {
      ok: true,
      data: {
        items: [
          { kind: 'degraded', count: 2 },
          { kind: 'failed', count: 1 },
          { kind: 'd1_write_failure', count: 4 },
        ],
      },
    },
  });
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

  await expect(page.locator('[data-module="projects"] [data-module-item="aindexer"]')).toContainText('9');
  await expect(page.locator('[data-module="projects"] [data-module-item="memcraft"]')).toContainText('4');
  await expect(page.locator('[data-module="agentSummary"] [data-module-item="JD 分析"]')).toContainText('5');
  await expect(page.locator('[data-module="agentSummary"] [data-module-item="技术栈"]')).toContainText('3');
  await expect(page.locator('[data-module="issues"] [data-module-item="degraded"]')).toContainText('回答降级');
  await expect(page.locator('[data-module="issues"] [data-module-item="failed"]')).toContainText('回答失败');
  await expect(page.locator('[data-module="issues"] [data-module-item="d1_write_failure"]')).toContainText('D1 写入失败');
  await expect(page.locator('[data-module="issues"] [data-module-item="d1_write_failure"]')).toContainText('4');
});

test('029-03: 四个非 overview 模块在无数据时显示空态', async ({ page }) => {
  await stubTrack(page);
  await stubNonOverviewStats(page, {
    pages: { ok: true, data: { items: [] } },
    projects: { ok: true, data: { items: [] } },
    agentSummary: { ok: true, data: { items: [] } },
    issues: { ok: true, data: { items: [] } },
  });
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

  for (const moduleKey of ['pages', 'projects', 'agentSummary', 'issues'] as const) {
    await expect(page.locator(`[data-module="${moduleKey}"]`)).toContainText('暂无数据');
    await expect(page.locator(`[data-module="${moduleKey}"]`)).not.toContainText('模块已连接，详情将在后续 issue 完成。');
  }
});

test('029-04: 四个非 overview 模块随 today|month|custom 时间窗口一起刷新', async ({ page }) => {
  const requestsByModule: Record<'pages' | 'projects' | 'agentSummary' | 'issues', string[]> = {
    pages: [],
    projects: [],
    agentSummary: [],
    issues: [],
  };

  await stubTrack(page);
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
  await page.route('**/api/admin/stats/pages**', async (route) => {
    const url = new URL(route.request().url());
    requestsByModule.pages.push(url.search);
    const isCustom = url.searchParams.has('startDate');
    const period = isCustom ? 'custom' : (url.searchParams.get('period') ?? 'missing');
    const itemByPeriod = {
      today: { path: '/today-page', count: 1 },
      week: { path: '/week-page', count: 2 },
      month: { path: '/month-page', count: 3 },
      custom: { path: '/custom-page', count: 8 },
      missing: { path: '/missing-page', count: 0 },
    } as const;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [itemByPeriod[period as keyof typeof itemByPeriod]] } }) });
  });
  await page.route('**/api/admin/stats/projects**', async (route) => {
    const url = new URL(route.request().url());
    requestsByModule.projects.push(url.search);
    const isCustom = url.searchParams.has('startDate');
    const period = isCustom ? 'custom' : (url.searchParams.get('period') ?? 'missing');
    const itemByPeriod = {
      today: { targetId: 'today-project', count: 2 },
      week: { targetId: 'week-project', count: 4 },
      month: { targetId: 'month-project', count: 6 },
      custom: { targetId: 'custom-project', count: 9 },
      missing: { targetId: 'missing-project', count: 0 },
    } as const;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [itemByPeriod[period as keyof typeof itemByPeriod]] } }) });
  });
  await page.route('**/api/admin/stats/agent-summary**', async (route) => {
    const url = new URL(route.request().url());
    requestsByModule.agentSummary.push(url.search);
    const isCustom = url.searchParams.has('startDate');
    const period = isCustom ? 'custom' : (url.searchParams.get('period') ?? 'missing');
    const itemByPeriod = {
      today: { keyword: '今日关键词', count: 1 },
      week: { keyword: '本周关键词', count: 2 },
      month: { keyword: '本月关键词', count: 3 },
      custom: { keyword: '自定义关键词', count: 7 },
      missing: { keyword: '缺失关键词', count: 0 },
    } as const;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [itemByPeriod[period as keyof typeof itemByPeriod]] } }) });
  });
  await page.route('**/api/admin/stats/issues**', async (route) => {
    const url = new URL(route.request().url());
    requestsByModule.issues.push(url.search);
    const isCustom = url.searchParams.has('startDate');
    const period = isCustom ? 'custom' : (url.searchParams.get('period') ?? 'missing');
    const itemByPeriod = {
      today: [{ kind: 'degraded', count: 1 }, { kind: 'failed', count: 0 }, { kind: 'd1_write_failure', count: 0 }],
      week: [{ kind: 'degraded', count: 2 }, { kind: 'failed', count: 1 }, { kind: 'd1_write_failure', count: 3 }],
      month: [{ kind: 'degraded', count: 4 }, { kind: 'failed', count: 2 }, { kind: 'd1_write_failure', count: 5 }],
      custom: [{ kind: 'degraded', count: 6 }, { kind: 'failed', count: 3 }, { kind: 'd1_write_failure', count: 9 }],
      missing: [{ kind: 'degraded', count: 0 }, { kind: 'failed', count: 0 }, { kind: 'd1_write_failure', count: 0 }],
    } as const;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: itemByPeriod[period as keyof typeof itemByPeriod] } }) });
  });
  await page.route('**/api/admin/logs**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 } }) });
  });

  await page.goto('/admin/');
  await page.getByLabel('管理员 Token').fill('secret-admin-token');
  await page.getByRole('button', { name: '进入面板' }).click();

  await expect(page.locator('[data-module="pages"]')).toContainText('/week-page');
  await expect(page.locator('[data-module="projects"]')).toContainText('week-project');
  await expect(page.locator('[data-module="agentSummary"]')).toContainText('本周关键词');
  await expect(page.locator('[data-module="issues"] [data-module-item="d1_write_failure"]')).toContainText('3');

  await page.getByRole('button', { name: '今日' }).click();
  await expect(page.locator('[data-module="pages"]')).toContainText('/today-page');
  await expect(page.locator('[data-module="projects"]')).toContainText('today-project');
  await expect(page.locator('[data-module="agentSummary"]')).toContainText('今日关键词');
  await expect(page.locator('[data-module="issues"] [data-module-item="degraded"]')).toContainText('1');

  await page.getByRole('button', { name: '本月' }).click();
  await expect(page.locator('[data-module="pages"]')).toContainText('/month-page');
  await expect(page.locator('[data-module="projects"]')).toContainText('month-project');
  await expect(page.locator('[data-module="agentSummary"]')).toContainText('本月关键词');
  await expect(page.locator('[data-module="issues"] [data-module-item="d1_write_failure"]')).toContainText('5');

  await page.getByRole('button', { name: '自定义' }).click();
  await page.fill('#startDate', '2026-06-15');
  await page.fill('#endDate', '2026-06-20');
  await expect(page.locator('[data-module="pages"]')).toContainText('/custom-page');
  await expect(page.locator('[data-module="projects"]')).toContainText('custom-project');
  await expect(page.locator('[data-module="agentSummary"]')).toContainText('自定义关键词');
  await expect(page.locator('[data-module="issues"] [data-module-item="d1_write_failure"]')).toContainText('9');

  for (const moduleKey of ['pages', 'projects', 'agentSummary', 'issues'] as const) {
    expect(requestsByModule[moduleKey]).toEqual(expect.arrayContaining(['?period=week', '?period=today', '?period=month', '?startDate=2026-06-15&endDate=2026-06-20']));
  }
});

test('029-05: 新榜单模块遇到 db_unavailable 时只在当前模块显示暂不可用', async ({ page }) => {
  await stubTrack(page);
  await stubNonOverviewStats(page, {
    pages: { ok: true, data: { items: [{ path: '/', count: 3 }] } },
    projects: { ok: true, data: { items: [{ targetId: 'aindexer', count: 2 }] } },
    agentSummary: { ok: true, data: { items: [{ keyword: 'JD 分析', count: 1 }] } },
    issues: { ok: false, reason: 'db_unavailable' },
  });
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

  await expect(page.locator('[data-module="issues"]')).toContainText('暂不可用');
  await expect(page.locator('[data-module="pages"]')).toContainText('/');
  await expect(page.locator('[data-module="projects"]')).toContainText('aindexer');
  await expect(page.locator('[data-module="agentSummary"]')).toContainText('JD 分析');
});
