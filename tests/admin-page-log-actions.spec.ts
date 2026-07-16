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

async function stubLogsList(page: Parameters<typeof test>[0]['page'], label = '第一页', turnCount = 1): Promise<void> {
  await page.route('**/api/admin/logs?*page=1&pageSize=20*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          items: [{
            id: 'session-1',
            visitorUuidShort: 'visitor-',
            agentSessionIdShort: 'session-',
            startedAt: '2026-06-28T10:00:00.000Z',
            lastTurnAt: '2026-06-28T11:00:00.000Z',
            turnCount,
            latestUserMessage: label,
          }],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        },
      }),
    });
  });
}

test('025-ui-01: 会话删除不弹 confirm，成功后刷新 logs 与 overview/issues', async ({ page }) => {
  let deleteUrl = '';
  let overviewRequests = 0;
  let issuesRequests = 0;
  let confirmShown = false;
  const alerts: string[] = [];

  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'confirm') confirmShown = true;
    if (dialog.type() === 'alert') alerts.push(dialog.message());
    await dialog.accept();
  });

  await stubTrack(page);
  await page.route('**/api/admin/auth', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.route('**/api/admin/stats/overview**', async (route) => {
    overviewRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { metrics: { pageViews: { current: overviewRequests, previous: 0 }, pdfDownloads: { current: 2, previous: 1 }, agentTurns: { current: 5, previous: 2 }, jdAnalyses: { current: 1, previous: 0 }, avgPageDurationMs: { current: 90000, previous: 45000 }, agentFailures: { current: 1, previous: 1 } } } }) });
  });
  await page.route('**/api/admin/stats/issues**', async (route) => {
    issuesRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [] } }) });
  });
  await page.route('**/api/admin/stats/pages**', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [] } }) }));
  await page.route('**/api/admin/stats/projects**', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [] } }) }));
  await page.route('**/api/admin/stats/agent-summary**', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [] } }) }));
  await page.route('**/api/admin/stats/agent-config**', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { runtime: { provider: 'test', model: null, temperature: null, effort: null, toolLoopCap: 5 }, startupContext: { files: [] }, tools: ['read_file'] } }) }));
  await stubLogsList(page, '删除前');
  await page.route('**/api/admin/logs?sessionId=session-1*', async (route) => {
    deleteUrl = route.request().url();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, deleted: 1 }) });
  });

  await page.goto('/admin/');
  await page.getByLabel('管理员 Token').fill('secret-admin-token');
  await page.getByRole('button', { name: '进入面板' }).click();
  await page.locator('[data-log-delete="session-1"]').click();

  expect(confirmShown).toBe(false);
  expect(deleteUrl).toContain('/api/admin/logs?sessionId=session-1');
  await expect.poll(() => alerts).toContain('已删除 1 轮提问记录');
  await expect.poll(() => overviewRequests).toBeGreaterThanOrEqual(2);
  await expect.poll(() => issuesRequests).toBeGreaterThanOrEqual(2);
});

test('025-ui-02: 范围删除显示带日期的 confirm，clear-all 需要 DELETE prompt', async ({ page }) => {
  const dialogs: Array<{ type: string; message: string; defaultValue: string }> = [];
  const deleteRequests: string[] = [];

  page.on('dialog', async (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message(), defaultValue: dialog.defaultValue() });
    if (dialog.type() === 'prompt') {
      await dialog.accept('DELETE');
      return;
    }
    await dialog.accept();
  });

  await stubAdminShell(page);
  await stubLogsList(page, '范围删除前');
  await page.route('**/api/admin/logs?*', async (route) => {
    if (route.request().method() === 'DELETE') {
      deleteRequests.push(route.request().url());
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, deleted: 2 }) });
      return;
    }
    await route.fallback();
  });

  await page.goto('/admin/');
  await page.getByLabel('管理员 Token').fill('secret-admin-token');
  await page.getByRole('button', { name: '进入面板' }).click();
  await page.getByRole('button', { name: '自定义' }).click();
  await page.fill('#startDate', '2026-06-15');
  await page.fill('#endDate', '2026-06-20');
  await page.getByRole('button', { name: '按时间范围删除' }).click();
  await page.getByRole('button', { name: '清空全部' }).click();

  await expect.poll(() => dialogs.filter((dialog) => dialog.type === 'alert').length).toBe(2);

  const confirms = dialogs.filter((dialog) => dialog.type === 'confirm');
  const prompts = dialogs.filter((dialog) => dialog.type === 'prompt');
  const alerts = dialogs.filter((dialog) => dialog.type === 'alert');
  expect(confirms[0]?.message).toContain('2026-06-15');
  expect(confirms[0]?.message).toContain('2026-06-20');
  expect(confirms).toHaveLength(2);
  expect(prompts[0]?.message).toContain('DELETE');
  expect(alerts.map((dialog) => dialog.message)).toEqual([
    '已删除 2 轮提问记录',
    '已删除 2 轮提问记录',
  ]);
  const rangeRequest = new URL(deleteRequests.find((url) => url.includes('rangeStart='))!);
  expect(rangeRequest.searchParams.get('rangeStart')).toBe('2026-06-15');
  expect(rangeRequest.searchParams.get('rangeEnd')).toBe('2026-06-20');
  expect(deleteRequests.some((url) => url.includes('all=true') && url.includes('confirm=DELETE'))).toBe(true);
});

test('043-01: 多轮 Session 先确认，取消不请求，成功提示服务端删除数', async ({ page }) => {
  const confirmMessages: string[] = [];
  const alerts: string[] = [];
  let deleteRequests = 0;

  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'confirm') {
      confirmMessages.push(dialog.message());
      if (confirmMessages.length === 1) {
        await dialog.dismiss();
      } else {
        await dialog.accept();
      }
      return;
    }
    if (dialog.type() === 'alert') alerts.push(dialog.message());
    await dialog.accept();
  });

  await stubAdminShell(page);
  await stubLogsList(page, '三轮会话', 3);
  await page.route('**/api/admin/logs?sessionId=session-1*', async (route) => {
    deleteRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, deleted: 2 }) });
  });

  await page.goto('/admin/');
  await page.getByLabel('管理员 Token').fill('secret-admin-token');
  await page.getByRole('button', { name: '进入面板' }).click();

  await page.locator('[data-log-delete="session-1"]').click();
  expect(confirmMessages[0]).toContain('3 轮');
  expect(deleteRequests).toBe(0);

  await page.locator('[data-log-delete="session-1"]').click();
  await expect.poll(() => alerts).toContain('已删除 2 轮提问记录');
  expect(deleteRequests).toBe(1);
});

test('043-02: 服务端删除数为 0 时提示未找到且不刷新', async ({ page }) => {
  let overviewRequests = 0;
  const alerts: string[] = [];

  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'alert') alerts.push(dialog.message());
    await dialog.accept();
  });

  await stubTrack(page);
  await stubNonOverviewStats(page);
  await page.route('**/api/admin/auth', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.route('**/api/admin/stats/overview**', async (route) => {
    overviewRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { metrics: { pageViews: { current: 1, previous: 0 }, pdfDownloads: { current: 0, previous: 0 }, agentTurns: { current: 0, previous: 0 }, jdAnalyses: { current: 0, previous: 0 }, avgPageDurationMs: { current: 0, previous: 0 }, agentFailures: { current: 0, previous: 0 } } } }) });
  });
  await stubLogsList(page, '仍然存在');
  await page.route('**/api/admin/logs?sessionId=session-1*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, deleted: 0 }) });
  });

  await page.goto('/admin/');
  await page.getByLabel('管理员 Token').fill('secret-admin-token');
  await page.getByRole('button', { name: '进入面板' }).click();
  await expect(page.locator('[data-log-row="session-1"]')).toContainText('仍然存在');
  expect(overviewRequests).toBe(1);

  await page.locator('[data-log-delete="session-1"]').click();

  await expect.poll(() => alerts).toContain('未找到可删除记录');
  expect(overviewRequests).toBe(1);
  await expect(page.locator('[data-log-row="session-1"]')).toContainText('仍然存在');
});

test('043-03: 删除失败时 alert 提示、保留列表并恢复按钮', async ({ page }) => {
  const alerts: string[] = [];
  let overviewRequests = 0;

  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'alert') alerts.push(dialog.message());
    await dialog.accept();
  });

  await stubTrack(page);
  await stubNonOverviewStats(page);
  await page.route('**/api/admin/auth', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.route('**/api/admin/stats/overview**', async (route) => {
    overviewRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { metrics: { pageViews: { current: 1, previous: 0 }, pdfDownloads: { current: 0, previous: 0 }, agentTurns: { current: 0, previous: 0 }, jdAnalyses: { current: 0, previous: 0 }, avgPageDurationMs: { current: 0, previous: 0 }, agentFailures: { current: 0, previous: 0 } } } }) });
  });
  await stubLogsList(page, '删除失败后保留');
  await page.route('**/api/admin/logs?sessionId=session-1*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'db_unavailable' }) });
  });

  await page.goto('/admin/');
  await page.getByLabel('管理员 Token').fill('secret-admin-token');
  await page.getByRole('button', { name: '进入面板' }).click();
  await expect.poll(() => overviewRequests).toBe(1);

  const deleteButton = page.locator('[data-log-delete="session-1"]');
  await deleteButton.click();

  await expect.poll(() => alerts).toContain('删除失败，请稍后重试');
  expect(overviewRequests).toBe(1);
  await expect(page.locator('[data-log-row="session-1"]')).toContainText('删除失败后保留');
  await expect(deleteButton).toBeEnabled();
});

test('043-05: 列表显示单轮但服务端发现多轮时再次确认并重试', async ({ page }) => {
  const confirms: string[] = [];
  const alerts: string[] = [];
  const deleteUrls: string[] = [];

  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'confirm') confirms.push(dialog.message());
    if (dialog.type() === 'alert') alerts.push(dialog.message());
    await dialog.accept();
  });

  await stubAdminShell(page);
  await stubLogsList(page, '当前窗口只有一轮', 1);
  await page.route('**/api/admin/logs?sessionId=session-1*', async (route) => {
    deleteUrls.push(route.request().url());
    const confirmed = new URL(route.request().url()).searchParams.get('confirm') === 'true';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(confirmed
        ? { ok: true, deleted: 2 }
        : { ok: false, reason: 'confirm_required', count: 2 }),
    });
  });

  await page.goto('/admin/');
  await page.getByLabel('管理员 Token').fill('secret-admin-token');
  await page.getByRole('button', { name: '进入面板' }).click();
  await page.locator('[data-log-delete="session-1"]').click();

  await expect.poll(() => alerts).toContain('已删除 2 轮提问记录');
  expect(confirms).toEqual(['确认删除这段会话的 2 轮提问记录吗？']);
  expect(deleteUrls).toHaveLength(2);
  expect(new URL(deleteUrls[0]).searchParams.has('confirm')).toBe(false);
  expect(new URL(deleteUrls[1]).searchParams.get('confirm')).toBe('true');
});

test('026-ui-01: 导出按钮默认导出当前范围，并支持全部导出且不刷新 dashboard', async ({ page }) => {
  const exportRequests: string[] = [];
  let logsGetRequests = 0;

  await stubAdminShell(page);
  await page.route('**/api/admin/logs?*page=1&pageSize=20*', async (route) => {
    logsGetRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [{ id: 'session-1', visitorUuidShort: 'visitor-', agentSessionIdShort: 'session-', startedAt: '2026-06-28T10:00:00.000Z', lastTurnAt: '2026-06-28T11:00:00.000Z', turnCount: 1, latestUserMessage: '当前列表' }], total: 1, page: 1, pageSize: 20, totalPages: 1 } }) });
  });
  await page.route('**/api/admin/logs/export?*', async (route) => {
    exportRequests.push(route.request().url());
    const isCsv = route.request().url().includes('format=csv');
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': isCsv ? 'text/csv; charset=utf-8' : 'application/json',
        'Content-Disposition': isCsv ? 'attachment; filename="agent-logs.csv"' : 'attachment; filename="agent-logs.json"',
      },
      body: isCsv ? 'id,created_at\n1,2026-06-28' : '[]',
    });
  });

  await page.goto('/admin/');
  await page.getByLabel('管理员 Token').fill('secret-admin-token');
  await page.getByRole('button', { name: '进入面板' }).click();
  await expect(page.locator('[data-logs-total]')).toContainText('共 1 段会话');
  const beforeText = await page.locator('[data-logs-total]').textContent();
  await page.getByRole('button', { name: '导出 CSV' }).click();
  await page.getByRole('button', { name: '导出 JSON' }).click();
  await page.getByLabel('导出全部数据').check();
  await page.getByRole('button', { name: '导出 CSV' }).click();
  const afterText = await page.locator('[data-logs-total]').textContent();

  expect(exportRequests.some((url) => url.includes('format=csv') && url.includes('period=week'))).toBe(true);
  expect(exportRequests.some((url) => url.includes('format=json') && url.includes('period=week'))).toBe(true);
  expect(exportRequests.some((url) => url.includes('format=csv') && url.includes('period=all'))).toBe(true);
  expect(afterText).toBe(beforeText);
  expect(logsGetRequests).toBe(1);
});

test('custom-ui-10: startDate 晚于 endDate 时显示错误并阻止刷新', async ({ page }) => {
  const overviewRequests: string[] = [];

  await stubAdminShell(page);
  await stubLogsList(page);

  await page.goto('/admin/');
  await page.getByLabel('管理员 Token').fill('secret-admin-token');
  await page.getByRole('button', { name: '进入面板' }).click();

  // 等待 dashboard 出现
  await expect(page.getByRole('heading', { name: '数据面板' })).toBeVisible();

  // 拦截 overview 请求以验证无效日期不会触发刷新
  await page.route('**/api/admin/stats/overview?*startDate*', async (route) => {
    overviewRequests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { metrics: { pageViews: { current: 99, previous: 0 }, pdfDownloads: { current: 0, previous: 0 }, agentTurns: { current: 0, previous: 0 }, jdAnalyses: { current: 0, previous: 0 }, avgPageDurationMs: { current: 0, previous: 0 }, agentFailures: { current: 0, previous: 0 } } } }) });
  });

  await page.getByRole('button', { name: '自定义' }).click();
  await page.fill('#startDate', '2026-06-20');
  await page.fill('#endDate', '2026-06-15');

  await expect(page.locator('[data-custom-range-error]')).toContainText('开始日期不能晚于结束日期');
  await page.waitForTimeout(1000);
  expect(overviewRequests.length).toBe(0);
});
