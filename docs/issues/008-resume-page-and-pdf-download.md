# Issue 008: /resume 在线简历页 + PDF 下载入口

**阶段**: 阶段 1
**类型**: AFK
**状态**: ready-for-agent

## Parent

`docs/prd/stage-1-static-pages.md`

## What to build

新建在线简历页，承载完整简历内容，即使 Agent 不可用也能独立成立。

**页面结构**：
- 复用阶段 0 已有组件：Education（教育经历）、Skills（技能栈）、Experience（实习经历），数据来自 `content/resume.json`。
- 新增项目索引区：列出所有项目名称 + tagline + 链接到 `/projects/[slug]`，数据来自 Content Collections。
- PDF 下载入口：链接到 `/resume.pdf`（public/ 下的静态文件，由用户手动提供）。
- 不含 Hero 和 Agent CTA（设计约束：Hero 仅首页，Agent CTA 仅首页）。
- 使用 SectionHeader 标注各区块，视觉风格与首页一致（暖白主题、单栏、留白充分）。
- 布局沿用 Base.astro 布局 + Nav + Footer。

**PDF 下载入口**：
- `/resume` 页面有 PDF 下载按钮/链接，指向 `/resume.pdf`。
- 首页 Hero 的"下载简历"按钮也指向 `/resume.pdf`（阶段 0 已有按钮，确认链接正确）。
- PDF 文件本身由用户手动放入 `public/resume.pdf`，代码只做链接，不做 PDF 生成。

**E2E 测试**：`/resume` 返回 200 且包含教育内容（学校名来自 resume.json）；`/resume` 包含项目索引且链接指向 `/projects/[slug]`；`/resume` 有 PDF 下载链接指向 `/resume.pdf`。

## Acceptance criteria

- [ ] /resume 返回 200
- [ ] /resume 包含教育经历（学校名来自 content/resume.json）
- [ ] /resume 包含实习经历（公司名来自 content/resume.json）
- [ ] /resume 包含技能栈
- [ ] /resume 包含项目索引区，列出全部项目名称
- [ ] 项目索引的每个项目有链接指向 /projects/[slug]
- [ ] /resume 有 PDF 下载入口指向 /resume.pdf
- [ ] 首页 Hero 的"下载简历"按钮指向 /resume.pdf
- [ ] /resume 不含 Hero 和 Agent CTA
- [ ] /resume 视觉风格与首页一致（暖白主题、单栏、SectionHeader）
- [ ] E2E 测试：/resume 可访问 + 内容来自 resume.json
- [ ] E2E 测试：项目索引链接指向 /projects/[slug]
- [ ] E2E 测试：PDF 下载链接存在
- [ ] `npm run build` 成功

## Blocked by

- Issue 006（需要 Nav 改造）
