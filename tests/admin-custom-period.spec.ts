import { test, expect } from '@playwright/test';
import { getCustomWindow, resolveWindow } from '../functions/api/admin/_period';

// ─────────────────────────────
// 自定义日期段筛选
// ─────────────────────────────

// ─── 切片 1-2: getCustomWindow ───

test('custom-01: getCustomWindow 返回正确的 ISO 窗口（含 endDate 当天）', () => {
  const window = getCustomWindow('2026-06-15', '2026-06-20');
  expect(window.current.startInclusive).toBe('2026-06-14T16:00:00.000Z'); // 6/15 00:00 CST = 6/14 16:00 UTC
  expect(window.current.endExclusive).toBe('2026-06-20T16:00:00.000Z');   // 6/21 00:00 CST = 6/20 16:00 UTC（含 6/20 整天）
});

test('custom-01b: getCustomWindow 同一天返回单日窗口', () => {
  const window = getCustomWindow('2026-06-15', '2026-06-15');
  expect(window.current.startInclusive).toBe('2026-06-14T16:00:00.000Z');
  expect(window.current.endExclusive).toBe('2026-06-15T16:00:00.000Z'); // 只含 6/15 一天
});

test('custom-02: getCustomWindow 自动计算上一个等长窗口', () => {
  const window = getCustomWindow('2026-06-15', '2026-06-20');
  // 6 天窗口（含 6/20），previous 应为 6/9-6/15
  expect(window.previous.startInclusive).toBe('2026-06-08T16:00:00.000Z'); // 6/9 00:00 CST
  expect(window.previous.endExclusive).toBe('2026-06-14T16:00:00.000Z');   // 6/15 00:00 CST
});

// ─── 切片 3-5: resolveWindow ───

test('custom-03: resolveWindow 有 startDate/endDate 走 custom 路径', () => {
  const url = new URL('http://localhost/api/admin/stats/overview?startDate=2026-06-15&endDate=2026-06-20');
  const window = resolveWindow(url);
  expect(window.current.startInclusive).toBe('2026-06-14T16:00:00.000Z');
  expect(window.current.endExclusive).toBe('2026-06-20T16:00:00.000Z');
});

test('custom-04: resolveWindow 无自定义日期走 period 路径', () => {
  const url = new URL('http://localhost/api/admin/stats/overview?period=week');
  const window = resolveWindow(url);
  // 应返回 week 窗口（周一到现在）
  const now = new Date();
  const currentStart = new Date(window.current.startInclusive);
  expect(currentStart.getTime()).toBeLessThan(now.getTime());
});

test('custom-05: resolveWindow start > end 返回错误', () => {
  const url = new URL('http://localhost/api/admin/stats/overview?startDate=2026-06-20&endDate=2026-06-15');
  expect(() => resolveWindow(url)).toThrow('invalid_date_range');
});

// ─── 切片 6: API 端点消费自定义日期 ───

// ─── 切片 7-9: 前端 E2E ───

test('custom-07: 自定义按钮 + date inputs 渲染', async ({ page }) => {
  await page.goto('http://localhost:4321/admin');
  await page.fill('#adminToken', '001125');
  await page.click('#loginButton');
  await page.waitForTimeout(1000);

  // 自定义按钮应存在
  const customButton = page.locator('[data-period="custom"]');
  await expect(customButton).toBeVisible();

  // 点击自定义按钮后 date inputs 应出现
  await customButton.click();
  const customRange = page.locator('[data-custom-range]');
  await expect(customRange).toBeVisible();
  await expect(page.locator('#startDate')).toBeVisible();
  await expect(page.locator('#endDate')).toBeVisible();
});

test('custom-08: 选完日期自动刷新所有模块', async ({ page }) => {
  await page.goto('http://localhost:4321/admin');
  await page.fill('#adminToken', '001125');
  await page.click('#loginButton');
  await page.waitForTimeout(1000);

  // 点击自定义按钮
  await page.click('[data-period="custom"]');
  await page.waitForTimeout(300);

  // 选择日期
  await page.fill('#startDate', '2026-06-15');
  await page.fill('#endDate', '2026-06-20');
  await page.waitForTimeout(1000);

  // Overview 应有数据（stat 卡不应是 "—"）
  const pageViewsValue = await page.locator('[data-metric-card="pageViews"] .stat-value').textContent();
  expect(pageViewsValue).not.toBe('—');
});

test('custom-09: 点预设按钮收起日期选择器', async ({ page }) => {
  await page.goto('http://localhost:4321/admin');
  await page.fill('#adminToken', '001125');
  await page.click('#loginButton');
  await page.waitForTimeout(1000);

  // 先展开自定义
  await page.click('[data-period="custom"]');
  await page.waitForTimeout(300);
  const customRange = page.locator('[data-custom-range]');
  await expect(customRange).toBeVisible();

  // 点预设按钮应收起
  await page.click('[data-period="week"]');
  await page.waitForTimeout(300);

  // 验证日期输入被清空
  const startValue = await page.locator('#startDate').inputValue();
  const endValue = await page.locator('#endDate').inputValue();
  expect(startValue).toBe('');
  expect(endValue).toBe('');

  // week 按钮应为 active
  const weekButton = page.locator('[data-period="week"]');
  await expect(weekButton).toHaveClass(/active/);
});

test('custom-10: 开始日期晚于结束日期时显示错误提示', async ({ page }) => {
  await page.goto('http://localhost:4321/admin');
  await page.evaluate(() => {
    const dashboard = document.querySelector<HTMLElement>('[data-view="dashboard"]');
    const range = document.querySelector<HTMLElement>('[data-custom-range]');
    const start = document.querySelector<HTMLInputElement>('#startDate');
    const end = document.querySelector<HTMLInputElement>('#endDate');
    if (!dashboard || !range || !start || !end) {
      throw new Error('admin custom-range fixture missing');
    }

    dashboard.style.display = '';
    range.classList.remove('hidden');
    start.value = '2026-06-20';
    end.value = '2026-06-15';
    start.dispatchEvent(new Event('change', { bubbles: true }));
    end.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await expect(page.locator('[data-custom-range-error]')).toContainText('开始日期不能晚于结束日期');
});

test('custom-06: overview 端点用自定义日期返回数据', async () => {
  const { onRequestGet } = await import('../functions/api/admin/stats/overview');
  const { FakeBehaviorEventStore, FakeAgentTurnStore, FakeRateLimitStore } = await import('../functions/api/_store/fake');

  const eventStore = new FakeBehaviorEventStore();
  const turnStore = new FakeAgentTurnStore();
  eventStore.records.push(
    { visitorUuid: 'v1', eventType: 'page_view', path: '/', createdAt: '2026-06-16T10:00:00.000Z' },
    { visitorUuid: 'v2', eventType: 'page_view', path: '/resume', createdAt: '2026-06-17T10:00:00.000Z' },
  );

  const ctx = {
    request: new Request('http://localhost/api/admin/stats/overview?startDate=2026-06-15&endDate=2026-06-20', {
      method: 'GET',
      headers: { Authorization: 'Bearer test-token' },
    }),
    env: { BEHAVIOR_EVENT_STORE: eventStore, AGENT_TURN_STORE: turnStore, RATE_LIMIT_STORE: new FakeRateLimitStore() },
  } as never;

  const res = await onRequestGet(ctx);
  const data = await (res as Response).json();
  expect(data.ok).toBe(true);
  expect(data.data.metrics.pageViews.current).toBe(2);
});
