import { test, expect } from '@playwright/test';

test('/projects 页面返回 200', async ({ page }) => {
  const response = await page.goto('/projects/');
  expect(response?.status()).toBe(200);
});

test('/projects 页面展示全部 4 个项目名称', async ({ page }) => {
  await page.goto('/projects/');
  const body = page.locator('body');
  await expect(body).toContainText('Aindexer');
  await expect(body).toContainText('角色记忆情境数据构建平台');
  await expect(body).toContainText('认知科学驱动的 AI 原型研发');
  await expect(body).toContainText('记忆系统测试与数据异常分析');
});

test('/projects 页面 ProjectCard 显示项目类型', async ({ page }) => {
  await page.goto('/projects/');
  const body = page.locator('body');
  await expect(body).toContainText('个人项目');
  await expect(body).toContainText('实习项目');
});

test('/projects 页面 ProjectCard 显示个人角色', async ({ page }) => {
  await page.goto('/projects/');
  const body = page.locator('body');
  await expect(body).toContainText('独立开发');
  await expect(body).toContainText('独立全栈开发');
  await expect(body).toContainText('社交产品实习生');
});

test('/projects 页面实习项目显示公司名称', async ({ page }) => {
  await page.goto('/projects/');
  const body = page.locator('body');
  await expect(body).toContainText('趣丸科技');
});

test('/projects 页面 ProjectCard 有查看详情链接指向 /projects/[slug]', async ({ page }) => {
  await page.goto('/projects/');
  const detailLinks = page.locator('.project-detail-link a');
  const count = await detailLinks.count();
  expect(count).toBeGreaterThanOrEqual(4);
  // 验证链接指向具体项目详情页（不是 /projects/ 本身）
  const firstHref = await detailLinks.first().getAttribute('href');
  expect(firstHref).toMatch(/\/projects\/[a-z-]+/);
});

test('/projects 页面 Nav 使用下拉菜单而非锚点', async ({ page }) => {
  await page.goto('/projects/');
  const navDropdowns = page.locator('nav .nav-dropdown');
  const count = await navDropdowns.count();
  expect(count).toBeGreaterThanOrEqual(2);
  // 下拉菜单存在且含子链接
  const menuLinks = page.locator('nav .dropdown-menu a');
  const linkCount = await menuLinks.count();
  expect(linkCount).toBeGreaterThanOrEqual(4);
});

test('首页 Nav 使用下拉菜单', async ({ page }) => {
  await page.goto('/');
  const navDropdowns = page.locator('nav .nav-dropdown');
  const count = await navDropdowns.count();
  expect(count).toBeGreaterThanOrEqual(2);
});
