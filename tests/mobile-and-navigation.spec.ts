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
    await expect(page.locator('body')).toContainText('Aindexer');
  });

  test('首页移动端点击 hero 空白区域会切换中英文前景层', async ({ page }) => {
    await page.goto('/');
    const heroSpotlight = page.locator('.hero-spotlight');
    const heroZh = page.locator('.hero-zh');
    const heroEn = page.locator('.hero-en');

    await expect(heroZh).toHaveCSS('opacity', '1');
    await expect(heroEn).toHaveCSS('pointer-events', 'none');

    await heroSpotlight.click({ position: { x: 24, y: 200 } });
    await expect(heroZh).toHaveCSS('opacity', '0');
    await expect(heroEn).toHaveCSS('pointer-events', 'auto');

    await heroSpotlight.click({ position: { x: 24, y: 200 } });
    await expect(heroZh).toHaveCSS('opacity', '1');
    await expect(heroEn).toHaveCSS('pointer-events', 'none');
  });

  test('首页移动端暗色层 ABOUT ME 可打开并关闭卡片', async ({ page }) => {
    await page.goto('/');
    const heroSpotlight = page.locator('.hero-spotlight');
    const hero = page.locator('#hero');
    const heroZh = page.locator('.hero-zh');
    const heroBack = page.locator('.hero-back');
    const heroCard = page.locator('.hero-card');
    const aboutMeButton = page.getByRole('button', { name: 'ABOUT ME' });
    const backButton = page.getByRole('button', { name: '← 返回' });

    await heroSpotlight.click({ position: { x: 24, y: 200 } });
    await expect(heroZh).toHaveCSS('opacity', '0');

    await aboutMeButton.click();
    await expect(hero).toHaveClass(/is-card-open/);
    await expect(heroBack).toHaveCSS('opacity', '1');
    await expect(heroCard).toContainText('欢迎来到我的主页');

    await backButton.click();
    await expect(hero).not.toHaveClass(/is-card-open/);
    await expect(heroBack).toHaveCSS('opacity', '0');
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

  test('Nav 包含简历链接', async ({ page }) => {
    await page.goto('/');
    const resumeLink = page.locator('nav a[href="/resume/"]');
    await expect(resumeLink).toBeVisible();
  });

  test('Nav 包含项目链接', async ({ page }) => {
    await page.goto('/');
    const projectLink = page.locator('nav a[href="/projects/"]');
    await expect(projectLink).toBeVisible();
  });

  test('从 /projects 点击查看详情进入详情页', async ({ page }) => {
    await page.goto('/projects/');
    const detailLink = page.locator('.project-title a').first();
    await detailLink.click();
    await expect(page).toHaveURL(/\/projects\/[a-z-]+/);
  });

  test('从详情页返回 /projects', async ({ page }) => {
    await page.goto('/projects/aindexer/');
    const backLink = page.locator('.back-link[href="/projects/"]');
    await backLink.click({ force: true });
    await expect(page).toHaveURL(/\/projects/);
  });

  test('首页不再显示查看全部项目链接', async ({ page }) => {
    await page.goto('/');
    const allProjectsLink = page.locator('.all-projects-link a[href="/projects/"]');
    await expect(allProjectsLink).toHaveCount(0);
  });

  test('移动端点击简历链接可跳转', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const resumeLink = page.locator('nav a[href="/resume/"]');
    await resumeLink.click();
    await expect(page).toHaveURL(/\/resume/);
  });

  test('键盘 Tab 可聚焦导航链接', async ({ page }) => {
    await page.goto('/');
    const resumeLink = page.locator('nav a[href="/resume/"]');
    await resumeLink.focus();
    await expect(resumeLink).toBeFocused();
  });
});

test.describe('构建完整性', () => {
  test('全部 5 个公开页面返回 200', async ({ page }) => {
    const pages = ['/', '/resume/', '/projects/', '/projects/aindexer/', '/projects/keyper/'];
    for (const url of pages) {
      const response = await page.goto(url);
      expect(response?.status(), `${url} should return 200`).toBe(200);
    }
  });

  test('4 个项目详情页全部返回 200', async ({ page }) => {
    const slugs = ['aindexer', 'keyper', 'human-like-agent', 'memory-system-testing'];
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
