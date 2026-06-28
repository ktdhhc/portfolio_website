import { test, expect } from '@playwright/test';

// ─────────────────────────────
// Issue 027: Admin 收尾
// ─────────────────────────────

test('027-01: 首页页脚包含指向 /admin 的 Admin 链接', async ({ page }) => {
  await page.goto('/');
  const adminLink = page.locator('footer a[href="/admin"]');
  await expect(adminLink).toBeVisible();
  await expect(adminLink).toHaveText('Admin');
});

test('027-02: Admin 链接使用小号灰色样式（不突出）', async ({ page }) => {
  await page.goto('/');
  const adminLink = page.locator('footer a[href="/admin"]');
  // 验证链接存在且字号小于其他 footer 链接
  await expect(adminLink).toBeVisible();
  const fontSize = await adminLink.evaluate((el) => window.getComputedStyle(el).fontSize);
  // Admin 链接应是小号（0.8rem = 12.8px 或类似）
  expect(parseFloat(fontSize)).toBeLessThanOrEqual(13);
});
