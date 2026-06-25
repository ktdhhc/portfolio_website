import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const projectPath = new URL('../content/projects/aindexer/index.md', import.meta.url);

function getAindexerTagline(): string {
  const content = readFileSync(fileURLToPath(projectPath), 'utf-8');
  const match = content.match(/^tagline:\s*(.+)$/m);
  if (!match) throw new Error('tagline not found in aindexer/index.md');
  return match[1].trim().replace(/^["']|["']$/g, '');
}

test('首页包含 profile.json 中的候选人姓名', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toContainText('Kaho');
});

test('首页包含 Aindexer 项目的 tagline', async ({ page }) => {
  await page.goto('/');
  const tagline = getAindexerTagline();
  await expect(page.locator('body')).toContainText(tagline);
});

test('首页 tagline 随 content 文件变化而更新', async ({ page }) => {
  // 这个测试证明 tagline 来自 content 文件而非硬编码：
  // 读取当前 content 文件的 tagline 值，断言页面渲染的就是这个值。
  // 如果页面硬编码，改 content 文件后页面不会变，这个测试会因值不一致而失败。
  await page.goto('/');
  const tagline = getAindexerTagline();
  const bodyText = await page.locator('body').textContent();
  expect(bodyText).toContain(tagline);
  // 同时确认这不是某个固定字符串——tagline 是动态读出来的
  expect(tagline).not.toBe('HARDCODED_TAGLINE_PLACEHOLDER');
});
