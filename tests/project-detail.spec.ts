import { test, expect } from '@playwright/test';

test('/projects/aindexer 详情页返回 200', async ({ page }) => {
  const response = await page.goto('/projects/aindexer/');
  expect(response?.status()).toBe(200);
});

test('/projects/aindexer 详情页包含九段式正文标题', async ({ page }) => {
  await page.goto('/projects/aindexer/');
  const body = page.locator('body');
  await expect(body).toContainText('项目背景');
  await expect(body).toContainText('解决的问题');
  await expect(body).toContainText('我的职责');
  await expect(body).toContainText('核心设计');
  await expect(body).toContainText('技术或工具');
  await expect(body).toContainText('产出结果');
  await expect(body).toContainText('难点与复盘');
  await expect(body).toContainText('可验证材料');
  await expect(body).toContainText('可追问问题');
});

test('/projects/aindexer 详情页顶部显示项目元信息', async ({ page }) => {
  await page.goto('/projects/aindexer/');
  const body = page.locator('body');
  // 项目名称
  await expect(body).toContainText('Aindexer');
  // 项目类型
  await expect(body).toContainText('个人项目');
  // 个人角色
  await expect(body).toContainText('独立开发');
  // 时间段
  await expect(body).toContainText('2025.12');
  // 能力标签（至少一个）
  await expect(body).toContainText('FastAPI');
});

test('/projects/aindexer 详情页有返回 /projects 的链接', async ({ page }) => {
  await page.goto('/projects/aindexer/');
  const backLink = page.locator('.back-link a[href="/projects/"]');
  await expect(backLink).toBeVisible();
});

test('/projects/nonexistent 返回 404', async ({ page }) => {
  const response = await page.goto('/projects/nonexistent/');
  expect(response?.status()).toBe(404);
});
