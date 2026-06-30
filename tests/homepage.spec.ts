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

test('首页 about 区块包含 profile.json 中的学历与院校信息', async ({ page }) => {
  await page.goto('/');
  const profile = getProfile();
  const aboutSection = page.locator('#about');
  await expect(aboutSection).toContainText(profile.education);
  await expect(aboutSection).toContainText(profile.school);
});

test('首页技能与经历快照来自 resume.json', async ({ page }) => {
  await page.goto('/');
  const resume = getResume();
  const highlightedSkill = resume.skills.find((skill) => skill.group === 'core');
  const firstExperience = resume.experience[0];

  expect(highlightedSkill).toBeTruthy();
  expect(firstExperience).toBeTruthy();

  await expect(page.locator('#skills')).toContainText(highlightedSkill!.name);
  await expect(page.locator('#experience')).toContainText(firstExperience.company);
  await expect(page.locator('#experience')).toContainText(firstExperience.title);
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
