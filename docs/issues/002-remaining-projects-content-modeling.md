# 002 · 剩余 3 个项目内容建模

**状态**: ready-for-agent
**Type**: AFK
**Parent PRD**: docs/prd/stage-0-scaffold-and-content-model.md

## What to build

复用 #1 已建立的 Content Collections schema 和项目目录结构，把另外 3 个项目写成完整内容：1 个个人项目（角色记忆情境数据构建平台）+ 2 个实习项目（认知科学驱动的 AI 原型研发、记忆系统测试与数据异常分析）。每个项目含 index.md 九段式正文 + refs/*.md 补充资料（含 summary）。实习项目的 frontmatter 含 company 字段（趣丸科技）。

实习项目内容披露边界：可写简历中没有的细节供 Agent 检索（ADR-0003 分层信息披露），但仅写可公开通过 Agent 间接披露的内容，不写 NDA 限制的内部数据。

## Acceptance criteria

- [ ] `content/projects/character-memory/index.md` 写完整九段式，frontmatter 含真实数据（type=personal, period 2026.02—2026.04, tags 含 FastAPI/React/Vite/Tailwind/SQLite/LLM API）
- [ ] `content/projects/character-memory/refs/` 至少 1 个补充资料文件，含 summary frontmatter
- [ ] `content/projects/ai-prototype-rd/index.md` 写完整九段式，frontmatter 含 type=internship, company=趣丸科技, period 2025.11—2026.05
- [ ] `content/projects/ai-prototype-rd/refs/` 至少 1 个补充资料文件，含 summary frontmatter
- [ ] `content/projects/memory-system-testing/index.md` 写完整九段式，frontmatter 含 type=internship, company=趣丸科技, period 2025.11—2026.05
- [ ] `content/projects/memory-system-testing/refs/` 至少 1 个补充资料文件，含 summary frontmatter
- [ ] 所有项目 frontmatter 通过 Zod schema 校验，`astro build` 不报错
- [ ] type=internship 的项目都含 company 字段，type=personal 的项目不含 company
- [ ] 实习项目内容不包含 NDA 限制的内部数据，可公开通过 Agent 间接披露
- [ ] 每个项目的九段式含完整 9 段标题（背景/问题/职责/设计/技术/结果/复盘/可验证材料/可追问问题）
- [ ] HEART-Bench 论文不建项目详情页（放 resume.json 经历里，由 #3 处理）

## Blocked by

- #001（依赖已建立的 schema 和目录结构）
