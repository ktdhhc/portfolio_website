# Issue 007: /projects/[slug] 项目详情页

**阶段**: 阶段 1
**类型**: AFK**状态**: ready-for-agent

## Parent

`docs/prd/stage-1-static-pages.md`

## What to build

新建项目详情页动态路由，构建时为每个项目生成静态 HTML。

**动态路由**：使用 `getStaticPaths()` 从 Content Collections 获取所有项目，为每个项目生成 `/projects/[slug]` 静态页面。slug 来自 Content Collections entry id（目录名）。

**页面结构**：
- 顶部元信息区：项目名称、类型（个人/实习）、个人角色、时间段、能力标签、外链（GitHub/Demo/文档）。实习项目显示公司名称。
- 正文区：渲染 `index.md` 的 Markdown 内容，即九段式叙述（项目背景 → 解决的问题 → 我的职责 → 核心设计 → 技术或工具 → 产出结果 → 难点与复盘 → 可验证材料 → 可追问问题）。使用 Astro 的 `render()` 或 `<Content />` 渲染 Markdown。
- 底部返回链接：回到 `/projects`。

**404 处理**：访问不存在的项目 slug 时返回 Astro 默认 404 页面。

**refs/ 不公开路由（ADR-0003）**：Content Collections 只注册 `projects` collection（指向 `content/projects` 的 `index.md`），`refs/*.md` 不注册为生成路由的 collection。项目详情页只渲染 index.md 正文，refs/ 内容不出现在任何公开页面。

**E2E 测试**：`/projects/aindexer` 返回 200 且包含九段式正文标题；`/projects/nonexistent` 返回 404；详情页有返回 `/projects` 的链接；从 `/projects` 页面点击"查看详情"能进入对应详情页。

## Acceptance criteria

- [ ] /projects/aindexer 返回 200 且渲染九段式正文
- [ ] /projects/character-memory 返回 200
- [ ] /projects/ai-prototype-rd 返回 200（实习项目，显示公司名称）
- [ ] /projects/memory-system-testing 返回 200（实习项目，显示公司名称）
- [ ] /projects/nonexistent 返回 404
- [ ] 详情页顶部显示项目元信息（名称、类型、角色、时间段、标签）
- [ ] 详情页正文是渲染后的 Markdown（含标题、段落、列表）
- [ ] 详情页有返回 /projects 的链接
- [ ] refs/*.md 不生成公开路由（dist/ 中无 refs 相关 HTML）
- [ ] E2E 测试：详情页可访问 + 九段式标题出现
- [ ] E2E 测试：404 路由覆盖
- [ ] E2E 测试：从 /projects 点击查看详情能进入详情页
- [ ] `npm run build` 成功，dist/ 包含 4 个项目详情页

## Blocked by

- Issue 006（需要 Nav 改造 + /projects 页面的返回入口）
