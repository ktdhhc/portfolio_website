import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

type ProjectMeta = {
  name: string;
  type: 'personal' | 'internship';
  role: string;
  company?: string;
};

function matchFrontmatterField(content: string, fieldName: string): string | undefined {
  const match = content.match(new RegExp(`^${fieldName}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : undefined;
}

function loadProjects(): ProjectMeta[] {
  const projectsRoot = join(process.cwd(), 'content', 'projects');
  return readdirSync(projectsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const content = readFileSync(join(projectsRoot, entry.name, 'index.md'), 'utf-8');
      return {
        name: matchFrontmatterField(content, 'name') ?? entry.name,
        type: (matchFrontmatterField(content, 'type') as ProjectMeta['type']) ?? 'personal',
        role: matchFrontmatterField(content, 'role') ?? '',
        company: matchFrontmatterField(content, 'company'),
      };
    });
}

test('/projects 页面返回 200', async ({ page }) => {
  const response = await page.goto('/projects/');
  expect(response?.status()).toBe(200);
});

test('/projects 页面展示全部项目名称', async ({ page }) => {
  await page.goto('/projects/');
  const body = page.locator('body');
  for (const project of loadProjects()) {
    await expect(body).toContainText(project.name);
  }
});

test('/projects 页面按 type 分为个人项目与实习项目两个编号 section', async ({ page }) => {
  await page.goto('/projects/');

  const personalProjects = loadProjects().filter((project) => project.type === 'personal');
  const internshipProjects = loadProjects().filter((project) => project.type === 'internship');

  const sections = page.locator('.project-group');
  await expect(sections).toHaveCount(2);
  await expect(sections.nth(0)).toContainText('01');
  await expect(sections.nth(0)).toContainText('个人项目');
  await expect(sections.nth(1)).toContainText('02');
  await expect(sections.nth(1)).toContainText('实习项目');

  await expect(sections.nth(0)).toContainText(`PERSONAL — ${String(personalProjects.length).padStart(2, '0')}`);
  await expect(sections.nth(1)).toContainText(`INTERNSHIP — ${String(internshipProjects.length).padStart(2, '0')}`);
});

test('/projects 页面展示 frontmatter 里的角色与实习公司', async ({ page }) => {
  await page.goto('/projects/');
  const body = page.locator('body');

  for (const role of new Set(loadProjects().map((project) => project.role))) {
    await expect(body).toContainText(role);
  }

  for (const company of new Set(loadProjects().flatMap((project) => (project.company ? [project.company] : [])))) {
    await expect(body).toContainText(company);
  }
});

test('/projects 页面项目标题保留到 /projects/[slug] 的详情导航', async ({ page }) => {
  await page.goto('/projects/');
  const detailLinks = page.locator('.project-title a');
  const count = await detailLinks.count();
  expect(count).toBe(loadProjects().length);
  const firstHref = await detailLinks.first().getAttribute('href');
  expect(firstHref).toMatch(/\/projects\/.+/);
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
