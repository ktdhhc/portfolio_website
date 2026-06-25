# 001 · Tracer bullet：Astro 工程初始化 + 单项目端到端内容驱动

**状态**: ready-for-agent
**Type**: AFK
**Parent PRD**: docs/prd/stage-0-scaffold-and-content-model.md

## What to build

最薄的端到端 vertical slice：初始化 Astro 工程（保留现有 docs/、demo/、CONTEXT.md、AGENTS.md），定义完整的 Content Collections schema（含项目 frontmatter 与 refs frontmatter 的 Zod 校验，schema 一次写全不分两次），建立标准目录结构，写 1 个项目（Aindexer）的完整内容（index.md 九段式 + refs/*.md 含 summary），写最小 profile.json（仅支撑首页 Hero 渲染所需字段），从 FRONTEND_DESIGN.md 提炼全局设计 token，最后用 Astro 页面重写首页并渲染出这个项目的卡片。

完成后，修改 Aindexer 的 tagline 后刷新首页，项目卡片描述随之变化——证明"内容驱动"机制真的跑通。schema 一次写全（含 type 枚举、company 条件必填、refs summary 必填），后续 issue 不再改 schema。

## Acceptance criteria

- [ ] Astro 工程初始化到当前目录，保留 `docs/`、`demo/`、`CONTEXT.md`、`AGENTS.md` 不被覆盖
- [ ] 目录结构建立：`content/`、`src/pages`、`src/components`、`src/layouts`、`src/styles`、`functions/api`（空）、`public/`（空）、`migrations/`（空）
- [ ] Content Collections schema 定义完整：项目 frontmatter（name/slug/tagline/type=personal\|internship/company 条件必填/role/period/tags/links/featured）+ refs frontmatter（summary 必填），用 Zod 校验
- [ ] `content/projects/aindexer/index.md` 写完整九段式正文（背景/问题/职责/设计/技术/结果/复盘/可验证材料/可追问问题），frontmatter 含 Aindexer 真实数据（type=personal, tagline, period 2025.12, tags, links 含 aindexer.cn 与 github.com/ktdhhc）
- [ ] `content/projects/aindexer/refs/` 至少 1 个补充资料文件，含 summary frontmatter
- [ ] `content/profile.json` 含首页 Hero 所需最小字段（姓名、定位、一句话描述、学历、院校、毕业时间、研究方向）
- [ ] `src/styles/global.css` 含 FRONTEND_DESIGN.md 的 `:root` 设计 token（颜色、字体栈、间距、圆角变量），不引入 Tailwind
- [ ] `src/pages/index.astro` 渲染首页，内容来自 `content/profile.json` + Content Collections，含导航 + Hero + 至少 1 张项目卡片（Aindexer）+ Footer
- [ ] 修改 `content/projects/aindexer/index.md` 的 tagline 后 `astro dev` 刷新首页，卡片描述变化
- [ ] 修改 `content/profile.json` 的姓名或定位后刷新首页，Hero 内容变化
- [ ] 配色对齐 FRONTEND_DESIGN.md 暖白主题（bg #faf8f5, accent #d4a574）
- [ ] `demo/index.html` 保留不删除
- [ ] `astro dev` 本地能跑起来无报错

## Blocked by

None - can start immediately
