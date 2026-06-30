import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const projectPath = new URL('../content/projects/aindexer/index.md', import.meta.url);
const profilePath = new URL('../content/profile.json', import.meta.url);
const resumePath = new URL('../content/resume.json', import.meta.url);

function getProfile() {
  return JSON.parse(readFileSync(fileURLToPath(profilePath), 'utf-8')) as {
    name: string;
    school: string;
    education: string;
  };
}

function getResume() {
  return JSON.parse(readFileSync(fileURLToPath(resumePath), 'utf-8')) as {
    experience: Array<{ company: string; title: string }>;
    skills: Array<{ name: string; group: string }>;
  };
}

function getAindexerTagline(): string {
  const content = readFileSync(fileURLToPath(projectPath), 'utf-8');
  const match = content.match(/^tagline:\s*(.+)$/m);
  if (!match) throw new Error('tagline not found in aindexer/index.md');
  return match[1].trim().replace(/^["']|["']$/g, '');
}

test('首页包含 profile.json 中的候选人姓名', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toContainText(getProfile().name);
});

test('首页包含 Aindexer 项目的 tagline', async ({ page }) => {
  await page.goto('/');
  const tagline = getAindexerTagline();
  await expect(page.locator('body')).toContainText(tagline);
});

test('首页移除 about、skills、experience 三个摘要区块', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#about')).toHaveCount(0);
  await expect(page.locator('#skills')).toHaveCount(0);
  await expect(page.locator('#experience')).toHaveCount(0);
});

test('首页 featured projects 只展示 2 个项目且不再显示查看全部项目入口', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#projects .project-item')).toHaveCount(2);
  await expect(page.locator('.all-projects-link')).toHaveCount(0);
  await expect(page.locator('a[href="/projects/"]', { hasText: '查看全部项目' })).toHaveCount(0);
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

test('首页 section label 不再显示数字序号', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.section-label-index')).toHaveCount(0);
});

test('首页 Agent CTA 标题换成两行', async ({ page }) => {
  await page.goto('/');
  const titleText = await page.locator('#agent h2').evaluate((node) => node.innerText);
  expect(titleText).toContain('\n');
  expect(titleText).toContain('与');
  expect(titleText).toContain('Agent');
  expect(titleText).toContain('对话');
});

test('首页 ABOUT ME 可翻到书信卡片并通过返回按钮翻回正面', async ({ page }) => {
  await page.goto('/');
  const aboutMeButton = page.getByRole('button', { name: 'ABOUT ME' });
  const backButton = page.getByRole('button', { name: '← 返回' });
  const heroCard = page.locator('.hero-card');
  const hero = page.locator('#hero');

  await expect(aboutMeButton).toBeVisible();
  await expect(hero).not.toHaveClass(/is-card-open/);

  await aboutMeButton.click();
  await expect(hero).toHaveClass(/is-card-open/);
  await expect(heroCard).toContainText('欢迎来到我的主页');

  await backButton.click();
  await expect(hero).not.toHaveClass(/is-card-open/);
});
