# Issue 006: Nav 多页面支持 + /projects 项目列表页

**阶段**: 阶段 1
**类型**: AFK
**状态**: ready-for-agent

## Parent

`docs/prd/stage-1-static-pages.md`

## What to build

这是阶段 1 的第一个 tracer bullet，建立多页面导航模式并交付最简单的新页面。

**Nav 组件改造**：当前 Nav 是纯锚点导航（`#about`、`#education` 等），需支持两种模式——首页用锚点滚动到对应 section，其他页面用页面级链接（`/`、`/resume`、`/projects`）。通过 `currentPage` prop 区分当前页面来决定链接模式。移动端导航链接继续隐藏（FRONTEND_DESIGN.md 第 16 节：MVP 可暂不实现汉堡菜单）。`/agent` 链接阶段 1 先指向首页 Agent CTA section（`/#agent`），阶段 2 再改为 `/agent`。

**新建 /projects 页面**：展示全部项目卡片网格，数据来自 Content Collections 的 `getCollection('projects')`（不限于首页的 featured 筛选）。使用 SectionHeader 标题 + 单栏卡片布局，移动端纵向堆叠。

**ProjectCard 组件增强**：当前只展示 name/tagline/period/tags/links，需补充：项目类型（type 字段，以 Badge 形式展示"个人项目"或"实习项目"）、个人角色（role 字段）、公司名称（company 字段，type=internship 时展示）、"查看详情"链接（指向 `/projects/[slug]`，slug 来自 Content Collections entry id）。增强后需向后兼容——首页的 Projects section 仍能用同一组件。

**E2E 测试**：`/projects` 返回 200 且包含全部项目名称；导航"项目"链接指向 `/projects`；导航"简历"链接指向 `/resume`（即使 /resume 页面此 slice 不建，链接可以先写好）。

## Acceptance criteria

- [ ] Nav 组件支持 `currentPage` prop，首页用锚点链接，其他页面用页面级链接
- [ ] Nav 在所有页面保持固定顶部 + backdrop-filter blur + 底部细边框
- [ ] 首页锚点导航（关于/教育/经历/项目）仍能滚动到对应 section
- [ ] 移动端导航链接继续隐藏
- [ ] /projects 页面返回 200
- [ ] /projects 页面展示全部项目（4 个项目名称都出现）
- [ ] ProjectCard 显示项目类型 Badge（个人项目 / 实习项目）
- [ ] ProjectCard 显示个人角色（role 字段）
- [ ] ProjectCard 实习项目显示公司名称（company 字段）
- [ ] ProjectCard 有"查看详情"链接指向 /projects/[slug]
- [ ] 首页 Projects section 仍正常渲染（向后兼容）
- [ ] E2E 测试：/projects 可访问 + 全部项目名称出现
- [ ] E2E 测试：导航链接指向正确页面
- [ ] `npm run build` 成功

## Blocked by

None — 可以立即开始
