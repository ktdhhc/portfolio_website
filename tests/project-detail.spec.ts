import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

function loadProjectHeadings(slug: string): string[] {
  const projectPath = new URL(`../content/projects/${slug}/index.md`, import.meta.url);
  const content = readFileSync(fileURLToPath(projectPath), 'utf-8');
  return Array.from(content.matchAll(/^##\s+(.+)$/gm), (match) => match[1].trim());
}

test('/projects/aindexer 详情页返回 200', async ({ page }) => {
  const response = await page.goto('/projects/aindexer/');
  expect(response?.status()).toBe(200);
});

test('/projects/aindexer 详情页包含九段式正文标题', async ({ page }) => {
  await page.goto('/projects/aindexer/');
  const body = page.locator('body');
  const headings = loadProjectHeadings('aindexer');
  for (const heading of headings) {
    await expect(body).toContainText(heading);
  }
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
