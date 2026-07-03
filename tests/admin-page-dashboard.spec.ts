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

test('029-01: 热门页面模块渲染排行卡，显示序号、路径与访问次数', async ({ page }) => {
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
  const rankItems = pagesModule.locator('[data-rank-item]');

  await expect(pagesModule.locator('[data-rank-list]')).toBeVisible();
  await expect(rankItems).toHaveCount(2);
  await expect(rankItems.nth(0)).toContainText('1');
  await expect(rankItems.nth(0)).toContainText('/');
  await expect(rankItems.nth(0)).toContainText('12');
  await expect(rankItems.nth(1)).toContainText('2');
  await expect(rankItems.nth(1)).toContainText('/resume');
  await expect(rankItems.nth(1)).toContainText('7');
});

test('029-02: 项目点击排行渲染项目标题、序号与点击次数', async ({ page }) => {
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

  const projectItems = page.locator('[data-module="projects"] [data-rank-item]');

  await expect(page.locator('[data-module="projects"] [data-rank-list]')).toBeVisible();
  await expect(projectItems).toHaveCount(2);
  await expect(projectItems.nth(0)).toContainText('1');
  await expect(projectItems.nth(0)).toContainText('Aindexer');
  await expect(projectItems.nth(0)).toContainText('9');
  await expect(projectItems.nth(1)).toContainText('2');
  await expect(projectItems.nth(1)).toContainText('MemCraft');
  await expect(projectItems.nth(1)).toContainText('4');
});

test('029-02b: Agent 配置直接显示 startup context、可读文件索引与 tools', async ({ page }) => {
  await stubTrack(page);
  await stubNonOverviewStats(page, {
    agentConfig: {
      ok: true,
      data: {
        runtime: {
          provider: 'deepseek',
          model: 'deepseek-chat',
          temperature: 0.4,
          effort: 'high',
          toolLoopCap: 5,
        },
        startupContext: {
          files: ['resume.json', 'projects/aindexer/index.md'],
        },
        tools: ['read_file'],
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

  const agentConfigModule = page.locator('[data-module="agent-config"]');
  const systemPromptTag = agentConfigModule.getByText('system prompt');
  await expect(agentConfigModule).toContainText('运行配置');
  await expect(agentConfigModule).toContainText('deepseek-chat');
  await expect(systemPromptTag).toBeVisible();
  await expect(systemPromptTag).toHaveCSS('padding-left', '12px');
  await expect(systemPromptTag).toHaveCSS('border-top-style', 'solid');
  await expect(agentConfigModule.getByText('answer rules')).toBeVisible();
  await expect(agentConfigModule.getByText('read_file')).toBeVisible();
});

test('029-02ba: 可读文件索引默认折叠，展开后显示文件列表', async ({ page }) => {
  await stubTrack(page);
  await stubNonOverviewStats(page, {
    agentConfig: {
      ok: true,
      data: {
        runtime: {
          provider: 'deepseek',
          model: 'deepseek-chat',
          temperature: 0.4,
          effort: 'high',
          toolLoopCap: 5,
        },
        startupContext: {
          files: ['resume.json', 'projects/aindexer/index.md'],
        },
        tools: ['read_file'],
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

  const agentConfigModule = page.locator('[data-module="agent-config"]');
  const fileIndexToggle = agentConfigModule.getByRole('button', { name: '可读文件索引（2 个）' });

  await expect(fileIndexToggle).toBeVisible();
  await expect(agentConfigModule.getByText('resume.json')).not.toBeVisible();
  await expect(agentConfigModule.getByText('projects/aindexer/index.md')).not.toBeVisible();

  await fileIndexToggle.click();

  await expect(agentConfigModule.getByText('resume.json')).toBeVisible();
  await expect(agentConfigModule.getByText('projects/aindexer/index.md')).toBeVisible();
});

test('029-02c: 高频问题模块渲染词云标签与次数', async ({ page }) => {
  await stubTrack(page);
  await stubNonOverviewStats(page, {
    agentSummary: {
      ok: true,
      data: {
        items: [
          { keyword: 'JD 分析', count: 5 },
          { keyword: '技术栈', count: 3 },
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

  const summaryModule = page.locator('[data-module="agentSummary"]');
  await expect(summaryModule.locator('[data-cloud-list]')).toBeVisible();
  await expect(summaryModule.locator('[data-cloud-tag="JD 分析"]')).toContainText('JD 分析');
  await expect(summaryModule.locator('[data-cloud-tag="JD 分析"]')).toContainText('5');
  await expect(summaryModule.locator('[data-cloud-tag="技术栈"]')).toContainText('技术栈');
  await expect(summaryModule.locator('[data-cloud-tag="技术栈"]')).toContainText('3');
});

test('029-02d: 失败与降级模块渲染专用问题列表与次数', async ({ page }) => {
  await stubTrack(page);
  await stubNonOverviewStats(page, {
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

  const issuesModule = page.locator('[data-module="issues"]');
  await expect(issuesModule.locator('[data-issue-list]')).toBeVisible();
  await expect(issuesModule.locator('[data-issue-item="degraded"]')).toContainText('回答降级');
  await expect(issuesModule.locator('[data-issue-item="degraded"]')).toContainText('2');
  await expect(issuesModule.locator('[data-issue-item="failed"]')).toContainText('回答失败');
  await expect(issuesModule.locator('[data-issue-item="failed"]')).toContainText('1');
  await expect(issuesModule.locator('[data-issue-item="d1_write_failure"]')).toContainText('D1 写入失败');
  await expect(issuesModule.locator('[data-issue-item="d1_write_failure"]')).toContainText('4');
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
  await page.route('**/api/admin/stats/agent-config**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { runtime: { provider: 'test', model: null, temperature: null, effort: null, toolLoopCap: 5 }, startupContext: { files: [] }, tools: ['read_file'] } }) });
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
  await expect(page.locator('[data-module="projects"]')).toContainText('Aindexer');
  await expect(page.locator('[data-module="agentSummary"]')).toContainText('JD 分析');
});
