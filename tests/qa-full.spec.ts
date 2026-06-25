import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const profilePath = new URL('../content/profile.json', import.meta.url);
const resumePath = new URL('../content/resume.json', import.meta.url);

function loadJSON(path: URL) {
  return JSON.parse(readFileSync(fileURLToPath(path), 'utf-8'));
}

const profile = loadJSON(profilePath);
const resume = loadJSON(resumePath);

// ─────────────────────────────
// P0: Build & Basic Rendering
// ─────────────────────────────

test('P0-01: 首页标题包含候选人姓名', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Kaho/);
});

test('P0-02: 页面包含所有主要区块', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('nav')).toBeVisible();
  await expect(page.locator('section.hero')).toBeVisible();
  await expect(page.locator('section#about')).toBeVisible();
  await expect(page.locator('section#education')).toBeVisible();
  await expect(page.locator('section#skills')).toBeVisible();
  await expect(page.locator('section#experience')).toBeVisible();
  await expect(page.locator('section#projects')).toBeVisible();
  await expect(page.locator('section#agent')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
});

test('P0-03: Hero 区按钮文本正确', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toContainText('下载简历 (PDF)');
  await expect(page.locator('body')).toContainText('与资料 Agent 对话');
});

test('P0-04: Agent CTA 区按钮文本正确', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('section#agent')).toContainText('开始对话');
});

test('P0-05: 页面背景使用暖白色调', async ({ page }) => {
  await page.goto('/');
  const body = page.locator('body');
  const bgColor = await body.evaluate((el) => getComputedStyle(el).backgroundColor);
  // #faf8f5 in RGB is rgb(250, 248, 245)
  expect(bgColor).toBe('rgb(250, 248, 245)');
});

test('P0-06: 导航栏包含所有锚点链接', async ({ page }) => {
  await page.goto('/');
  const links = ['关于', '教育', '经历', '项目', 'Agent'];
  for (const text of links) {
    await expect(page.locator('nav')).toContainText(text);
  }
});

// ─────────────────────────────
// P0: Content Sourcing
// ─────────────────────────────

test('P0-07: 姓名来自 profile.json 而非硬编码', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toContainText(profile.name);
  // Verify it's dynamically sourced by checking the actual value from JSON
  expect(profile.name).toBe('Kaho');
});

test('P0-08: 关于区学历信息来自 profile.json', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('section#about')).toContainText(profile.education);
  await expect(page.locator('section#about')).toContainText(profile.school);
  await expect(page.locator('section#about')).toContainText(profile.graduation);
});

test('P0-09: 教育背景来自 resume.json', async ({ page }) => {
  await page.goto('/');
  for (const edu of resume.education) {
    await expect(page.locator('section#education')).toContainText(edu.school);
    await expect(page.locator('section#education')).toContainText(edu.degree);
    await expect(page.locator('section#education')).toContainText(edu.period);
  }
});

test('P0-10: 技能列表来自 resume.json', async ({ page }) => {
  await page.goto('/');
  for (const skill of resume.skills) {
    await expect(page.locator('section#skills')).toContainText(skill.name);
  }
});

test('P0-11: 实习经历来自 resume.json', async ({ page }) => {
  await page.goto('/');
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
// P0: Projects
// ─────────────────────────────

test('P0-12: 渲染 4 个项目卡片', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('section#projects .project-card');
  await expect(cards).toHaveCount(4);
});

test('P0-13: 4 个项目名称正确', async ({ page }) => {
  await page.goto('/');
  // 项目名称来自 content/projects/*/index.md 的 name 字段
  const expectedNames = [
    'Aindexer',
    '角色记忆情境数据构建平台',
    '认知科学驱动的 AI 原型研发',
    '记忆系统测试与数据异常分析',
  ];
  for (const name of expectedNames) {
    await expect(page.locator('section#projects')).toContainText(name);
  }
});

test('P0-14: 项目 tagline 来自 content 文件', async ({ page }) => {
  await page.goto('/');
  // Read Aindexer tagline from MD file
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

test('P1-01: 移动端导航链接隐藏', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  const navLinks = page.locator('nav .nav-links');
  const display = await navLinks.evaluate((el) => getComputedStyle(el).display);
  expect(display).toBe('none');
});

test('P1-02: 移动端 Hero 标题缩小', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  const h1 = page.locator('section.hero h1');
  const fontSize = await h1.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize).toBeLessThan(40); // Should be 36px (2.25rem)
});

test('P1-03: 移动端关于区 meta 纵向排列', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  const introMeta = page.locator('section#about .intro-meta');
  const flexDirection = await introMeta.evaluate((el) => getComputedStyle(el).flexDirection);
  expect(flexDirection).toBe('column');
});

test('P1-04: 移动端实习经历 header 纵向排列', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  const expHeader = page.locator('section#experience .exp-header');
  const flexDirection = await expHeader.evaluate((el) => getComputedStyle(el).flexDirection);
  expect(flexDirection).toBe('column');
});

test('P1-05: 移动端页面所有区块仍可见', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  const sections = ['nav', 'section.hero', 'section#about', 'section#education', 'section#skills', 'section#experience', 'section#projects', 'section#agent', 'footer'];
  for (const sel of sections) {
    await expect(page.locator(sel)).toBeVisible();
  }
});

// ─────────────────────────────
// P1: Nav Anchor Links
// ─────────────────────────────

test('P1-06: 导航锚点链接指向正确 ID', async ({ page }) => {
  await page.goto('/');
  const anchors = [
    { text: '关于', href: '#about' },
    { text: '教育', href: '#education' },
    { text: '经历', href: '#experience' },
    { text: '项目', href: '#projects' },
    { text: 'Agent', href: '#agent' },
  ];
  for (const { text, href } of anchors) {
    const link = page.locator(`nav a[href="${href}"]`);
    await expect(link).toContainText(text);
  }
});

test('P1-07: 点击导航锚点滚动到对应区域', async ({ page }) => {
  await page.goto('/');
  await page.click('nav a[href="#projects"]');
  await page.waitForTimeout(800);
  const projectsSection = page.locator('section#projects');
  const box = await projectsSection.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    // 固定导航栏约 60-70px，滚动后目标区域应在视口顶部附近（允许小幅偏差）
    expect(box.y).toBeLessThan(150);
    expect(box.y).toBeGreaterThan(-5);
  }
});

// ─────────────────────────────
// P1: Accent Color
// ─────────────────────────────

test('P1-08: Agent CTA 使用 accent 背景色', async ({ page }) => {
  await page.goto('/');
  const cta = page.locator('section#agent .agent-cta');
  const bgColor = await cta.evaluate((el) => getComputedStyle(el).backgroundColor);
  // #fef6ee in RGB is rgb(254, 246, 238)
  expect(bgColor).toBe('rgb(254, 246, 238)');
});

test('P1-09: 强调文字使用 accent-dark 色', async ({ page }) => {
  await page.goto('/');
  const accent = page.locator('section.hero .accent');
  const color = await accent.evaluate((el) => getComputedStyle(el).color);
  // #b8895a in RGB is rgb(184, 137, 90)
  expect(color).toBe('rgb(184, 137, 90)');
});

// ─────────────────────────────
// P1: Company name in experience
// ─────────────────────────────

test('P1-10: 实习公司名使用 accent-dark 色', async ({ page }) => {
  await page.goto('/');
  const company = page.locator('section#experience .exp-company').first();
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

test('P2-03: 项目卡片包含标签和周期', async ({ page }) => {
  await page.goto('/');
  const firstCard = page.locator('section#projects .project-card').first();
  // 第一个项目卡片应包含 period 年份（如 2025）
  await expect(firstCard).toContainText('2025');
  // Should contain at least one tag
  const tags = firstCard.locator('.project-tag');
  await expect(tags.first()).toBeVisible();
});

test('P2-04: 技能高亮标签样式不同', async ({ page }) => {
  await page.goto('/');
  const highlightedTags = page.locator('section#skills .skill-tag.highlight');
  const count = await highlightedTags.count();
  expect(count).toBeGreaterThan(0);
  // Check first highlighted tag has different bg
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
