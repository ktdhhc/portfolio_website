import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Profile = {
  readonly description: string;
};

type ResumeEducation = {
  readonly school: string;
  readonly degree: string;
  readonly detail: string;
  readonly period: string;
};

type ResumeProject = {
  readonly title: string;
  readonly description: string;
};

type ResumeExperience = {
  readonly company: string;
  readonly title: string;
  readonly period: string;
  readonly description: string;
  readonly projects: readonly ResumeProject[];
};

type ResumeSkill = {
  readonly name: string;
  readonly group: 'core' | 'tool' | 'research';
};

type ResumeData = {
  readonly education: readonly ResumeEducation[];
  readonly experience: readonly ResumeExperience[];
  readonly skills: readonly ResumeSkill[];
};

type ProjectFrontmatter = {
  readonly name: string;
  readonly tagline: string;
};

const resumePdfPath = fileURLToPath(new URL('../public/resume.pdf', import.meta.url));
const contentRoot = fileURLToPath(new URL('../content/', import.meta.url));
const profile = loadJson<Profile>(join(contentRoot, 'profile.json'));
const resumeData = loadJson<ResumeData>(join(contentRoot, 'resume.json'));
const projectFrontmatters = loadProjectFrontmatters();

function loadJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function extractFrontmatterField(frontmatter: string, field: string): string {
  const match = frontmatter.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  if (!match) {
    throw new Error(`Missing frontmatter field ${field}`);
  }

  return match[1].trim().replace(/^['"]|['"]$/g, '');
}

function loadProjectFrontmatters(): readonly ProjectFrontmatter[] {
  const projectsRoot = join(contentRoot, 'projects');

  return readdirSync(projectsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const markdown = readFileSync(join(projectsRoot, entry.name, 'index.md'), 'utf8');
      const frontmatterMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);

      if (!frontmatterMatch) {
        throw new Error(`Missing frontmatter in ${entry.name}/index.md`);
      }

      const frontmatter = frontmatterMatch[1];

      return {
        name: extractFrontmatterField(frontmatter, 'name'),
        tagline: extractFrontmatterField(frontmatter, 'tagline'),
      };
    });
}

test('/resume 页面可正常渲染', async ({ page }) => {
  await page.goto('/resume/');
  await expect(page.getByRole('heading', { name: '在线简历', level: 1 })).toBeVisible();
});

test('/resume 使用资料页头与编号 sections', async ({ page }) => {
  await page.goto('/resume/');

  await expect(page.getByRole('heading', { name: '在线简历', level: 1 })).toBeVisible();
  await expect(page.locator('.page-header')).toContainText(profile.description);

  const resumeHeader = page.locator('.page-header');
  await expect(resumeHeader).toContainText('下载 PDF 简历');
  await expect(resumeHeader.getByRole('link', { name: '与 Agent 对话' })).toHaveAttribute('href', '/agent/');

  const sectionLabels = page.locator('.section-label-meta');
  await expect(sectionLabels).toHaveCount(4);
  await expect(sectionLabels.nth(0)).toContainText('01');
  await expect(sectionLabels.nth(0)).toContainText('教育');
  await expect(sectionLabels.nth(1)).toContainText('02');
  await expect(sectionLabels.nth(1)).toContainText('实习');
  await expect(sectionLabels.nth(2)).toContainText('03');
  await expect(sectionLabels.nth(2)).toContainText('技能');
  await expect(sectionLabels.nth(3)).toContainText('04');
  await expect(sectionLabels.nth(3)).toContainText('项目索引');
});

test('/resume 教育与实习内容来自 resume.json', async ({ page }) => {
  await page.goto('/resume/');

  const educationSection = page.locator('#education');
  for (const entry of resumeData.education) {
    await expect(educationSection).toContainText(entry.school);
    await expect(educationSection).toContainText(entry.degree);
    await expect(educationSection).toContainText(entry.detail);
    await expect(educationSection).toContainText(entry.period);
  }

  const experienceSection = page.locator('#experience');
  for (const entry of resumeData.experience) {
    await expect(experienceSection).toContainText(entry.title);
    await expect(experienceSection).toContainText(entry.company);
    await expect(experienceSection).toContainText(entry.period);
    await expect(experienceSection).toContainText(entry.description);

    for (const project of entry.projects) {
      await expect(experienceSection).toContainText(project.title);
      await expect(experienceSection).toContainText(project.description);
    }
  }
});

test('/resume 技能按 group 分组展示', async ({ page }) => {
  await page.goto('/resume/');

  const skillsSection = page.locator('#skills');
  const groupLabels = new Map<ResumeSkill['group'], string>([
    ['core', '核心能力'],
    ['tool', '工程工具'],
    ['research', '研究方法'],
  ]);

  await expect(skillsSection).toContainText('核心能力');
  await expect(skillsSection).toContainText('工程工具');
  await expect(skillsSection).toContainText('研究方法');

  for (const [group, label] of groupLabels) {
    const groupColumn = skillsSection.locator('.skills-group').filter({ has: page.getByRole('heading', { name: label }) });
    for (const skill of resumeData.skills.filter((entry) => entry.group === group)) {
      await expect(groupColumn).toContainText(skill.name);
    }
  }
});

test('/resume 项目索引来自当前项目 frontmatter', async ({ page }) => {
  await page.goto('/resume/');

  const projectSection = page.locator('#projects');
  const projectLinks = projectSection.locator('a[href^="/projects/"]');
  await expect(projectLinks).toHaveCount(projectFrontmatters.length);

  for (const project of projectFrontmatters) {
    const projectItem = projectSection.locator('li').filter({ hasText: project.name });
    await expect(projectItem).toContainText(project.tagline);
    await expect(projectItem.getByRole('link', { name: new RegExp(project.name) })).toHaveAttribute('href', /\/projects\/[^/]+\/$/);
  }
});

test('/resume 在 PDF 缺失时显示待补充文案而非坏链接', async ({ page }) => {
  await page.goto('/resume/');
  const resumeHeader = page.locator('.page-header-actions');

  if (existsSync(resumePdfPath)) {
    await expect(resumeHeader.getByRole('link', { name: '下载 PDF 简历' })).toHaveAttribute('href', '/resume.pdf');
  } else {
    await expect(resumeHeader).toContainText('PDF 简历待补充');
    await expect(resumeHeader.locator('a[href="/resume.pdf"]')).toHaveCount(0);
  }
});

test('首页 Hero 在 PDF 缺失时显示待补充文案而非坏链接', async ({ page }) => {
  await page.goto('/');
  if (existsSync(resumePdfPath)) {
    const heroButton = page.locator('.hero a[href="/resume.pdf"]').first();
    await expect(heroButton).toBeVisible();
  } else {
    await expect(page.locator('.hero .hero-actions')).toContainText('PDF 简历待补充');
    await expect(page.locator('.hero a[href="/resume.pdf"]')).toHaveCount(0);
  }
});
