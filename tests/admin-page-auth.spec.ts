import { expect, test } from '@playwright/test';
import { stubTrack } from './admin-page.helpers';

test('023-01: 未登录访问 /admin 时显示登录卡片且不显示 dashboard', async ({ page }) => {
  await stubTrack(page);

  const response = await page.goto('/admin/');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
  await expect(page.getByRole('button', { name: '进入面板' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '数据面板' })).toHaveCount(0);
});

test('023-03: 登录失败时区分 invalid 与 rate_limited 文案', async ({ page }) => {
  await stubTrack(page);
  await page.goto('/admin/');

  await page.route('**/api/admin/auth', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'invalid' }) });
  });

  await page.getByLabel('管理员 Token').fill('wrong-token');
  await page.getByRole('button', { name: '进入面板' }).click();
  await expect(page.locator('[data-login-error]')).toContainText('Token 错误');

  await page.unroute('**/api/admin/auth');
  await page.route('**/api/admin/auth', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'rate_limited' }) });
  });

  await page.getByRole('button', { name: '进入面板' }).click();
  await expect(page.locator('[data-login-error]')).toContainText('尝试过于频繁');
});

test('023-06: 退出会清空 localStorage 和 sessionStorage 并回到登录态', async ({ page }) => {
  await stubTrack(page);
  await page.route('**/api/admin/auth', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.route('**/api/admin/stats/**', async (route) => {
    const url = route.request().url();
    const body = url.includes('/overview')
      ? {
          ok: true,
          data: {
            metrics: {
              pageViews: { current: 1, previous: 0 },
              pdfDownloads: { current: 0, previous: 0 },
              agentTurns: { current: 0, previous: 0 },
              jdAnalyses: { current: 0, previous: 0 },
              avgPageDurationMs: { current: 0, previous: 0 },
              agentFailures: { current: 0, previous: 0 },
            },
          },
        }
      : { ok: true, data: { items: [] } };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto('/admin/');
  await page.evaluate(() => sessionStorage.setItem('admin-temp', 'keep-me'));
  await page.getByLabel('管理员 Token').fill('secret-admin-token');
  await page.getByRole('button', { name: '进入面板' }).click();
  await expect(page.getByRole('heading', { name: '数据面板' })).toBeVisible();

  await page.getByRole('button', { name: '退出' }).click();

  await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
  await expect(page.evaluate(() => localStorage.getItem('portfolio_admin_token'))).resolves.toBeNull();
  await expect(page.evaluate(() => sessionStorage.getItem('admin-temp'))).resolves.toBeNull();
});
