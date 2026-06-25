import { test, expect } from '@playwright/test';

test.describe('移动端视口 (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('/projects 页面移动端可浏览', async ({ page }) => {
    const response = await page.goto('/projects/');
    expect(response?.status()).toBe(200);
    await expect(page.locator('body')).toContainText('Aindexer');
  });

  test('/projects 页面移动端导航可见', async ({ page }) => {
    await page.goto('/projects/');
    const navLinks = page.locator('nav .nav-links');
    await expect(navLinks).toBeVisible();
  });

  test('/resume 页面移动端可浏览', async ({ page }) => {
    const response = await page.goto('/resume/');
    expect(response?.status()).toBe(200);
    await expect(page.locator('body')).toContainText('华南师范大学');
  });

  test('/projects/aindexer 详情页移动端可浏览', async ({ page }) => {
    const response = await page.goto('/projects/aindexer/');
    expect(response?.status()).toBe(200);
    await expect(page.locator('body')).toContainText('项目背景');
  });
});

test.describe('页面间导航', () => {
  test('桌面 hover 简历菜单会展开下拉', async ({ page }) => {
    await page.goto('/');
    const dropdown = page.locator('nav .nav-dropdown').first();
    const menu = dropdown.locator('.dropdown-menu');
    await dropdown.hover();
    await expect(menu).toBeVisible();
  });

  test('Nav 下拉包含简历子链接', async ({ page }) => {
    await page.goto('/');
    const resumeLinks = page.locator('nav .dropdown-menu a[href*="/resume"]');
    const count = await resumeLinks.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('Nav 下拉包含项目子链接', async ({ page }) => {
    await page.goto('/');
    const projectLinks = page.locator('nav .dropdown-menu a[href*="/projects/"]');
    const count = await projectLinks.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('从 /projects 点击查看详情进入详情页', async ({ page }) => {
    await page.goto('/projects/');
    const detailLink = page.locator('.project-detail-link a').first();
    await detailLink.click();
    await expect(page).toHaveURL(/\/projects\/[a-z-]+/);
  });

  test('从详情页返回 /projects', async ({ page }) => {
    await page.goto('/projects/aindexer/');
    const backLink = page.locator('.back-link a[href="/projects/"]');
    await backLink.click();
    await expect(page).toHaveURL(/\/projects/);
  });

  test('首页有查看全部项目链接', async ({ page }) => {
    await page.goto('/');
    const allProjectsLink = page.locator('.all-projects-link a[href="/projects/"]');
    await expect(allProjectsLink).toBeVisible();
  });

  test('移动端点击简历菜单会展开下拉', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const dropdownLabel = page.locator('nav .nav-dropdown .dropdown-label').first();
    const menu = page.locator('nav .nav-dropdown .dropdown-menu').first();
    await dropdownLabel.click();
    await expect(menu).toBeVisible();
  });

  test('键盘 Enter 可展开简历菜单', async ({ page }) => {
    await page.goto('/');
    const dropdownLabel = page.locator('nav .nav-dropdown .dropdown-label').first();
    const menu = page.locator('nav .nav-dropdown .dropdown-menu').first();
    await dropdownLabel.press('Enter');
    await expect(menu).toBeVisible();
  });
});

test.describe('构建完整性', () => {
  test('全部 5 个公开页面返回 200', async ({ page }) => {
    const pages = ['/', '/resume/', '/projects/', '/projects/aindexer/', '/projects/character-memory/'];
    for (const url of pages) {
      const response = await page.goto(url);
      expect(response?.status(), `${url} should return 200`).toBe(200);
    }
  });

  test('4 个项目详情页全部返回 200', async ({ page }) => {
    const slugs = ['aindexer', 'character-memory', 'ai-prototype-rd', 'memory-system-testing'];
    for (const slug of slugs) {
      const response = await page.goto(`/projects/${slug}/`);
      expect(response?.status(), `/projects/${slug}/ should return 200`).toBe(200);
    }
  });

  test('不存在项目 slug 返回 404', async ({ page }) => {
    const response = await page.goto('/projects/nonexistent/');
    expect(response?.status()).toBe(404);
  });
});
