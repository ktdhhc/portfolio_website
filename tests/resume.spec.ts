import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const resumePdfPath = fileURLToPath(new URL('../public/resume.pdf', import.meta.url));

test('/resume 页面返回 200', async ({ page }) => {
  const response = await page.goto('/resume/');
  expect(response?.status()).toBe(200);
});

test('/resume 包含教育经历（学校名来自 resume.json）', async ({ page }) => {
  await page.goto('/resume/');
  const body = page.locator('body');
  await expect(body).toContainText('华南师范大学');
  await expect(body).toContainText('华南农业大学');
});

test('/resume 包含实习经历（公司名来自 resume.json）', async ({ page }) => {
  await page.goto('/resume/');
  const body = page.locator('body');
  await expect(body).toContainText('趣丸科技');
});

test('/resume 包含技能栈', async ({ page }) => {
  await page.goto('/resume/');
  const body = page.locator('body');
  await expect(body).toContainText('Python');
  await expect(body).toContainText('FastAPI');
  await expect(body).toContainText('Prompt Engineering');
});

test('/resume 包含项目索引并链接到详情页', async ({ page }) => {
  await page.goto('/resume/');
  const body = page.locator('body');
  // 项目名称出现
  await expect(body).toContainText('Aindexer');
  await expect(body).toContainText('角色记忆情境数据构建平台');
  // 有链接指向项目详情页
  const detailLinks = page.locator('a[href*="/projects/"]');
  const hrefs = await detailLinks.evaluateAll((els) =>
    els.map((el) => el.getAttribute('href')).filter((h) => h?.match(/\/projects\/[a-z-]+/))
  );
  expect(hrefs.length).toBeGreaterThanOrEqual(4);
});

test('/resume 在 PDF 缺失时显示待补充文案而非坏链接', async ({ page }) => {
  expect(existsSync(resumePdfPath)).toBe(false);
  await page.goto('/resume/');
  await expect(page.locator('.pdf-download')).toContainText('PDF 简历待补充');
  await expect(page.locator('.pdf-download a[href="/resume.pdf"]')).toHaveCount(0);
});

test('首页 Hero 在 PDF 缺失时显示待补充文案而非坏链接', async ({ page }) => {
  expect(existsSync(resumePdfPath)).toBe(false);
  await page.goto('/');
  await expect(page.locator('.hero .hero-actions')).toContainText('PDF 简历待补充');
  await expect(page.locator('.hero a[href="/resume.pdf"]')).toHaveCount(0);
});
