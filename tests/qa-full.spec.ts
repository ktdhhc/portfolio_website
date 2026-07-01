import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const profilePath = new URL('../content/profile.json', import.meta.url);
const resumePath = new URL('../content/resume.json', import.meta.url);

function loadJSON(path: URL) {
  return JSON.parse(readFileSync(fileURLToPath(path), 'utf-8'));
}

const profile = loadJSON(profilePath);
const resume = loadJSON(resumePath);

function loadProjectNames(): string[] {
  const projectsRoot = join(process.cwd(), 'content', 'projects');
  return readdirSync(projectsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const content = readFileSync(join(projectsRoot, entry.name, 'index.md'), 'utf-8');
      const match = content.match(/^name:\s*(.+)$/m);
      return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : entry.name;
    });
}

// ─────────────────────────────
// P0: Build & Basic Rendering
// ─────────────────────────────

test('P0-01: 首页标题包含候选人姓名', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Kaho/);
});

test('P0-02: 首页包含核心区块', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('nav')).toBeVisible();
  await expect(page.locator('section.hero')).toBeVisible();
  await expect(page.locator('section#projects')).toBeVisible();
  await expect(page.locator('section#agent')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
});

test('P0-03: Hero 区按钮文本正确', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toContainText('下载 PDF');
  await expect(page.locator('body')).toContainText('与 Agent 对话');
});

test('P0-04: Agent CTA 区按钮文本正确', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('section#agent')).toContainText('开始对话');
});

test('P0-05: 页面背景使用暖白色调', async ({ page }) => {
  await page.goto('/');
  const body = page.locator('body');
  const bgColor = await body.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bgColor).toBe('rgb(250, 248, 245)');
});

test('P0-06: 导航栏包含直接链接', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('nav')).toContainText('简历');
  await expect(page.locator('nav')).toContainText('项目');
  await expect(page.locator('nav')).toContainText('Agent');
  const resumeLink = page.locator('nav a[href="/resume/"]');
  const projectLink = page.locator('nav a[href="/projects/"]');
  await expect(resumeLink).toBeVisible();
  await expect(projectLink).toBeVisible();
});

// ─────────────────────────────
// P0: Content Sourcing (首页)
// ─────────────────────────────

test('P0-07: 姓名来自 profile.json 而非硬编码', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toContainText(profile.name);
  expect(profile.name).toBe('Kaho');
});

// ─────────────────────────────
// P0: Content Sourcing (/resume 页面)
// ─────────────────────────────

test('P0-09: 教育背景来自 resume.json (/resume)', async ({ page }) => {
  await page.goto('/resume/');
  for (const edu of resume.education) {
    await expect(page.locator('section#education')).toContainText(edu.school);
    await expect(page.locator('section#education')).toContainText(edu.degree);
    await expect(page.locator('section#education')).toContainText(edu.period);
  }
});

test('P0-10: 技能列表来自 resume.json (/resume)', async ({ page }) => {
  await page.goto('/resume/');
  for (const skill of resume.skills) {
    await expect(page.locator('section#skills')).toContainText(skill.name);
  }
});

test('P0-11: 实习经历来自 resume.json (/resume)', async ({ page }) => {
  await page.goto('/resume/');
  for (const exp of resume.experience) {
    await expect(page.locator('section#experience')).toContainText(exp.company);
    await expect(page.locator('section#experience')).toContainText(exp.title);
    await expect(page.locator('section#experience')).toContainText(exp.period);
    for (const proj of exp.projects) {
      await expect(page.locator('section#experience')).toContainText(proj.title);
    }
  }
});

// ─────────────────────────────
// P0: Projects (/projects 页面)
// ─────────────────────────────

test('P0-12: /projects 渲染全部项目卡片', async ({ page }) => {
  await page.goto('/projects/');
  const cards = page.locator('.project-item');
  await expect(cards).toHaveCount(loadProjectNames().length);
});

test('P0-13: /projects 项目名称与 content 一致', async ({ page }) => {
  await page.goto('/projects/');
  for (const name of loadProjectNames()) {
    await expect(page.locator('body')).toContainText(name);
  }
});

test('P0-14: /projects 项目 tagline 来自 content 文件', async ({ page }) => {
  await page.goto('/projects/');
  const aindexerPath = new URL('../content/projects/aindexer/index.md', import.meta.url);
  const content = readFileSync(fileURLToPath(aindexerPath), 'utf-8');
  const match = content.match(/^tagline:\s*(.+)$/m);
  if (match) {
    const tagline = match[1].trim().replace(/^["']|["']$/g, '');
    await expect(page.locator('body')).toContainText(tagline);
  }
});

// ─────────────────────────────
// P0: 首页 Featured Projects
// ─────────────────────────────

test('P0-12-home: 首页展示 featured 项目卡片', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('section#projects .project-item');
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(1);
  expect(count).toBeLessThan(4);
});

test('P0-14-home: 首页 featured 项目 tagline', async ({ page }) => {
  await page.goto('/');
  const aindexerPath = new URL('../content/projects/aindexer/index.md', import.meta.url);
  const content = readFileSync(fileURLToPath(aindexerPath), 'utf-8');
  const match = content.match(/^tagline:\s*(.+)$/m);
  if (match) {
    const tagline = match[1].trim().replace(/^["']|["']$/g, '');
    await expect(page.locator('section#projects')).toContainText(tagline);
  }
});

// ─────────────────────────────
// P0: External Links
// ─────────────────────────────

test('P0-15: Footer 包含 GitHub 链接', async ({ page }) => {
  await page.goto('/');
  const githubLink = page.locator('footer a[href*="github.com"]');
  await expect(githubLink).toBeVisible();
  await expect(githubLink).toHaveAttribute('href', profile.github);
});

test('P0-16: Footer 包含产品主页链接 (aindexer.cn)', async ({ page }) => {
  await page.goto('/');
  const homepageLink = page.locator(`footer a[href="${profile.homepage}"]`);
  await expect(homepageLink).toBeVisible();
});

test('P0-17: Footer 包含 Email 链接', async ({ page }) => {
  await page.goto('/');
  const emailLink = page.locator(`footer a[href="mailto:${profile.email}"]`);
  await expect(emailLink).toBeVisible();
});

// ─────────────────────────────
// P1: Responsive (Mobile)
// ─────────────────────────────

test('P1-02: 移动端 Hero 标题缩小', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  const h1 = page.locator('section.hero h1');
  const fontSize = await h1.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize).toBeLessThan(50);
});

test('P1-05: 移动端首页核心区块仍可见', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  const sections = ['nav', 'section.hero', 'section#projects', 'section#agent', 'footer'];
  for (const sel of sections) {
    await expect(page.locator(sel)).toBeVisible();
  }
});

test('P1-04-resume: 移动端 /resume 实习经历 header 纵向排列', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/resume/');
  const expHeader = page.locator('section#experience .exp-header');
  const flexDirection = await expHeader.evaluate((el) => getComputedStyle(el).flexDirection);
  expect(flexDirection).toBe('column');
});

// ─────────────────────────────
// P1: Nav Links
// ─────────────────────────────

test('P1-06: Nav 包含简历直接链接', async ({ page }) => {
  await page.goto('/');
  const resumeLink = page.locator('nav a[href="/resume/"]');
  await expect(resumeLink).toBeVisible();
});

test('P1-07: Nav 包含项目直接链接', async ({ page }) => {
  await page.goto('/');
  const projectLink = page.locator('nav a[href="/projects/"]');
  await expect(projectLink).toBeVisible();
});

// ─────────────────────────────
// P1: Accent Color
// ─────────────────────────────

test('P1-08: Agent CTA 使用 accent 背景色', async ({ page }) => {
  await page.goto('/');
  const cta = page.locator('section#agent .agent-btn');
  const bgColor = await cta.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bgColor).toBe('rgb(254, 246, 238)');
});

test('P1-09: Hero 简历主按钮在 PDF 可用时可见', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('section.hero a[href="/resume.pdf"]').first()).toBeVisible();
});

test('P1-10: /projects 实习公司名使用 accent-dark 色', async ({ page }) => {
  await page.goto('/projects/');
  const company = page.locator('.project-company').first();
  const color = await company.evaluate((el) => getComputedStyle(el).color);
  expect(color).toBe('rgb(184, 137, 90)');
});

// ─────────────────────────────
// P2: Meta & Edge Cases
// ─────────────────────────────

test('P2-01: 页面语言设置为 zh-CN', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('lang', 'zh-CN');
});

test('P2-02: viewport meta 标签存在', async ({ page }) => {
  await page.goto('/');
  const viewport = page.locator('meta[name="viewport"]');
  await expect(viewport).toHaveAttribute('content', 'width=device-width, initial-scale=1.0');
});

test('P2-03: /projects 项目卡片包含标签和周期', async ({ page }) => {
  await page.goto('/projects/');
  const firstCard = page.locator('.project-card').first();
  await expect(firstCard).toContainText('2025');
  const tags = firstCard.locator('.project-tag');
  await expect(tags.first()).toBeVisible();
});

test('P2-04: /resume 技能高亮标签样式不同', async ({ page }) => {
  await page.goto('/resume/');
  const highlightedTags = page.locator('section#skills .skill-tag.highlight');
  const count = await highlightedTags.count();
  expect(count).toBeGreaterThan(0);
  const firstHighlight = highlightedTags.first();
  const bgColor = await firstHighlight.evaluate((el) => getComputedStyle(el).backgroundColor);
  const nonHighlight = page.locator('section#skills .skill-tag:not(.highlight)').first();
  const nonBgColor = await nonHighlight.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bgColor).not.toBe(nonBgColor);
});

test('P2-05: 页面无 console error', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(errors).toHaveLength(0);
});

test('P2-06: 导航栏有 backdrop-filter', async ({ page }) => {
  await page.goto('/');
  const nav = page.locator('nav');
  const backdropFilter = await nav.evaluate((el) => getComputedStyle(el).backdropFilter);
  expect(backdropFilter).not.toBe('none');
});
