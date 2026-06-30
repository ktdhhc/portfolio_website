import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

type ProjectFrontmatter = {
  readonly name: string;
  readonly type: 'personal' | 'internship';
  readonly role: string;
  readonly period: string;
  readonly company?: string;
  readonly tags: readonly string[];
  readonly links: {
    readonly github?: string;
    readonly demo?: string;
    readonly docs?: string;
    readonly paper?: string;
  };
};

function parseScalar(frontmatter: string, field: string): string | undefined {
  const match = frontmatter.match(new RegExp(`^\\s*${field}:\\s*(.+)$`, 'm'));
  return match?.[1]?.trim().replace(/^"|"$/g, '');
}

function loadProjectMarkdown(slug: string): {
  readonly frontmatter: ProjectFrontmatter;
  readonly headings: readonly string[];
} {
  const projectPath = new URL(`../content/projects/${slug}/index.md`, import.meta.url);
  const content = readFileSync(fileURLToPath(projectPath), 'utf-8');
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

  if (!frontmatterMatch) {
    throw new Error(`Missing frontmatter in ${slug}`);
  }

  const frontmatterSource = frontmatterMatch[1];
  const tagsBlock = frontmatterSource.match(/(?:^|\n)tags:\n((?:\s+- .+\n?)*)/m)?.[1] ?? '';
  const linksBlock = frontmatterSource.match(/(?:^|\n)links:\n((?:\s{2}.+\n?)*)/m)?.[1] ?? '';
  const headings = Array.from(content.matchAll(/^##\s+(.+)$/gm), (match) => match[1].trim());

  const frontmatter: ProjectFrontmatter = {
    name: parseScalar(frontmatterSource, 'name') ?? '',
    type: (parseScalar(frontmatterSource, 'type') as 'personal' | 'internship') ?? 'personal',
    role: parseScalar(frontmatterSource, 'role') ?? '',
    period: parseScalar(frontmatterSource, 'period') ?? '',
    company: parseScalar(frontmatterSource, 'company'),
    tags: Array.from(tagsBlock.matchAll(/^\s+-\s+(.+)$/gm), (match) => match[1].trim()),
    links: {
      github: parseScalar(linksBlock, 'github'),
      demo: parseScalar(linksBlock, 'demo'),
      docs: parseScalar(linksBlock, 'docs'),
      paper: parseScalar(linksBlock, 'paper'),
    },
  };

  return { frontmatter, headings };
}

const aindexerProject = loadProjectMarkdown('aindexer');
const heartBenchProject = loadProjectMarkdown('HEART-Bench');

test('/projects/aindexer 详情页返回 200', async ({ page }) => {
  const response = await page.goto('/projects/aindexer/');
  expect(response?.status()).toBe(200);
});

test('/projects/aindexer 详情页包含九段式正文标题', async ({ page }) => {
  await page.goto('/projects/aindexer/');
  const body = page.locator('body');
  for (const heading of aindexerProject.headings) {
    await expect(body).toContainText(heading);
  }
});

test('/projects/aindexer 详情页顶部显示项目元信息', async ({ page }) => {
  await page.goto('/projects/aindexer/');

  await expect(page.locator('.article-title')).toHaveText(aindexerProject.frontmatter.name);
  await expect(page.locator('.article-type')).toHaveText('个人项目');
  await expect(page.locator('.article-meta')).toContainText(aindexerProject.frontmatter.role);
  await expect(page.locator('.article-meta')).toContainText(aindexerProject.frontmatter.period);
  await expect(page.locator('.article-tags')).toContainText(aindexerProject.frontmatter.tags[0]);
  await expect(page.locator('.body-label')).toHaveText('正文');
  await expect(page.locator('.body-content')).toContainText(aindexerProject.headings[0]);
});

test('/projects/aindexer 详情页头部和正文末尾都有返回 /projects 的链接', async ({ page }) => {
  await page.goto('/projects/aindexer/');
  const headerBackLink = page.locator('.article-links a[href="/projects/"]');
  const backLink = page.locator('.back-link a[href="/projects/"]');

  await expect(headerBackLink).toBeVisible();
  await expect(backLink).toBeVisible();
});

test('/projects/HEART-Bench 详情页显示实习公司与 arXiv 论文链接', async ({ page }) => {
  await page.goto('/projects/HEART-Bench/');

  await expect(page.locator('.article-type')).toHaveText('实习项目');
  await expect(page.locator('.article-meta')).toContainText(heartBenchProject.frontmatter.role);
  await expect(page.locator('.article-meta')).toContainText(heartBenchProject.frontmatter.period);
  await expect(page.locator('.article-meta')).toContainText(heartBenchProject.frontmatter.company ?? '');

  const paperLink = page.locator(`.article-links a[href="${heartBenchProject.frontmatter.links.paper}"]`);
  await expect(paperLink).toBeVisible();
  await expect(paperLink).toContainText('arXiv');
});

test('/projects/aindexer 详情页正文图片使用项目详情样式', async ({ page }) => {
  await page.goto('/projects/aindexer/');

  const imageStyle = await page.locator('.body-content').evaluate((element) => {
    const image = document.createElement('img');
    image.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    image.alt = 'style-check';
    element.appendChild(image);

    const computedStyle = window.getComputedStyle(image);
    const result = {
      maxWidth: computedStyle.maxWidth,
      borderTopLeftRadius: computedStyle.borderTopLeftRadius,
      marginTop: computedStyle.marginTop,
      marginBottom: computedStyle.marginBottom,
    };

    image.remove();
    return result;
  });

  expect(imageStyle.maxWidth).toBe('100%');
  expect(imageStyle.borderTopLeftRadius).toBe('12px');
  expect(imageStyle.marginTop).toBe('24px');
  expect(imageStyle.marginBottom).toBe('24px');
});

test('/projects/nonexistent 返回 404', async ({ page }) => {
  const response = await page.goto('/projects/nonexistent/');
  expect(response?.status()).toBe(404);
});
