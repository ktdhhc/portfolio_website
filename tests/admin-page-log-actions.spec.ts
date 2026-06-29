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

async function stubLogsList(page: Parameters<typeof test>[0]['page'], label = '第一页'): Promise<void> {
  await page.route('**/api/admin/logs?*page=1&pageSize=20*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          items: [{ id: 'turn-1', createdAt: '2026-06-28T11:00:00.000Z', userMessage: label, turnType: 'chat', answerStatus: 'success' }],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        },
      }),
    });
  });
}

test('025-ui-01: 单条删除不弹 confirm，成功后刷新 logs 与 overview/issues', async ({ page }) => {
  let deleteUrl = '';
  let overviewRequests = 0;
  let issuesRequests = 0;
  let confirmShown = false;

  page.on('dialog', async (dialog) => {
    confirmShown = true;
    await dialog.dismiss();
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
  await stubLogsList(page, '删除前');
  await page.route('**/api/admin/logs?id=turn-1', async (route) => {
    deleteUrl = route.request().url();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, deleted: 1 }) });
  });

  await page.goto('/admin/');
  await page.getByLabel('管理员 Token').fill('secret-admin-token');
  await page.getByRole('button', { name: '进入面板' }).click();
  await page.locator('[data-log-delete="turn-1"]').click();

  expect(confirmShown).toBe(false);
  expect(deleteUrl).toContain('/api/admin/logs?id=turn-1');
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

  expect(dialogs[0]?.type).toBe('confirm');
  expect(dialogs[0]?.message).toContain('2026-06-15');
  expect(dialogs[0]?.message).toContain('2026-06-20');
  expect(dialogs[1]?.type).toBe('confirm');
  expect(dialogs[2]?.type).toBe('prompt');
  expect(dialogs[2]?.message).toContain('DELETE');
  expect(deleteRequests.some((url) => url.includes('rangeStart=') && url.includes('rangeEnd='))).toBe(true);
  expect(deleteRequests.some((url) => url.includes('all=true') && url.includes('confirm=DELETE'))).toBe(true);
});

test('026-ui-01: 导出按钮默认导出当前范围，并支持全部导出且不刷新 dashboard', async ({ page }) => {
  const exportRequests: string[] = [];
  let logsGetRequests = 0;

  await stubAdminShell(page);
  await page.route('**/api/admin/logs?*page=1&pageSize=20*', async (route) => {
    logsGetRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [{ id: 'turn-1', createdAt: '2026-06-28T11:00:00.000Z', userMessage: '当前列表', turnType: 'chat', answerStatus: 'success' }], total: 1, page: 1, pageSize: 20, totalPages: 1 } }) });
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
  await expect(page.locator('[data-logs-total]')).toContainText('共 1 条记录');
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
