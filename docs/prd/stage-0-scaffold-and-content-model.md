# PRD: 阶段 0 — 脚手架与内容建模

**状态**: ready-for-agent
**所属阶段**: 阶段 0（脚手架与内容建模）
**上游约束**: ADR-0001（Astro）、ADR-0003（refs 不公开路由）、CONTEXT.md 术语、FRONTEND_DESIGN.md 设计约束、CURRENT_STATE.md frontmatter schema

---

## Problem Statement

项目已有完整的设计约束（FRONTEND_DESIGN.md）、架构决策（7 个 ADR）、领域术语（CONTEXT.md）和一份对齐设计约束的 demo（demo/index.html，暖白主题），但**没有可运行的 Astro 工程**。所有个人资料目前硬编码在 demo 的 HTML 里，无法通过修改 Markdown / JSON 来更新内容。

在进入后续阶段（静态页面全集、Agent、数据采集、admin、上线）之前，必须先建立工程脚手架和内容模型，让"内容驱动"这个核心机制真正跑通——改 `content/` 文件即改页面，组件代码不承载个人资料。

## Solution

初始化 Astro 工程到当前目录（保留现有 docs/、demo/、CONTEXT.md、AGENTS.md），建立标准的目录结构（`content/`、`src/`、`functions/`、`public/`、`migrations/`），配置 Content Collections 用 Zod schema 校验项目与 refs 的 frontmatter，把简历数据从 demo 抽到 `content/profile.json` + `content/resume.json`，把项目内容写成 `content/projects/{slug}/index.md`（九段式）+ `content/projects/{slug}/refs/*.md`（Agent 参考资料，含 summary），写好 Agent 的 system-prompt 与 answer-rules，提炼 FRONTEND_DESIGN.md 的设计 token 到全局样式，最后用 Astro 页面重写首页并读取 content/ 数据。

完成后，改 `content/` 文件即可更新首页内容，无需改组件代码；构建时 frontmatter 缺字段会报错，保证内容完整性；后续阶段有了明确的落地位置。

## User Stories

1. 作为开发者，我希望初始化 Astro 工程并保留现有 docs/ 和 demo/，这样我不会丢失已有的设计约束、ADR 和设计原型
2. 作为开发者，我希望建立标准的目录结构（content/、src/、functions/、public/、migrations/），这样后续阶段有明确的落地位置
3. 作为开发者，我希望配置 Content Collections schema 用 Zod 校验项目 frontmatter，这样内容缺失或类型错误能在构建时报错而非上线后才发现
4. 作为开发者，我希望 Content Collections schema 校验 refs 的 summary 字段，这样 Agent 文件索引的摘要不会遗漏
5. 作为开发者，我希望 type 字段被枚举校验为 personal | internship，这样不会出现无效的项目类型
6. 作为开发者，我希望 company 字段在 type=internship 时必填、type=personal 时不需要，这样实习项目的公司信息被强制保留而个人项目不会有多余字段
7. 作为开发者，我希望把简历基本信息抽到 profile.json，这样改个人信息只需改 JSON 不需改页面代码
8. 作为开发者，我希望把教育和经历抽到 resume.json，这样简历页和首页能共享同一数据源
9. 作为开发者，我希望每个项目的九段式正文写成 index.md，这样项目详情页（阶段 1）能直接渲染 Markdown
10. 作为开发者，我希望每个项目的补充资料放在 refs/ 目录并带 summary frontmatter，这样 Agent（阶段 2）能基于索引检索
11. 作为开发者，我希望写好 Agent 的 system-prompt.md 和 answer-rules.md，这样阶段 2 实现 Agent 时有现成的人格与边界约束
12. 作为开发者，我希望 system-prompt 落地产品大纲 5.1 节的 Agent 定位与说明文案，这样 Agent 的身份边界从一开始就明确
13. 作为开发者，我希望 answer-rules 落地产品大纲 5.2 节的八条回答原则，这样 Agent 的行为约束以可读文档形式存在
14. 作为开发者，我希望把 FRONTEND_DESIGN.md 的设计 token 提炼到全局 CSS 变量，这样所有页面共享同一套颜色、间距、圆角
15. 作为开发者，我希望首页用 Astro 页面重写并读取 content/ 数据，这样首页内容来自文件而非硬编码
16. 作为开发者，我希望改 content/profile.json 的字段后刷新页面内容随之更新，这样能验证内容驱动真的生效
17. 作为开发者，我希望 demo 的暖白主题配色在 Astro 首页中保留，这样设计风格不丢失
18. 作为开发者，我希望 astro dev 能在本地跑起来，这样我能即时预览改动
19. 作为开发者，我希望构建时如果项目 frontmatter 缺必填字段会报错，这样我不会发布不完整的项目内容
20. 作为开发者，我希望保留 demo/index.html 不删除，这样我有设计参考备份
21. 作为开发者，我希望不引入 Tailwind 或其他 CSS 框架，用 Astro 原生 `<style>` 实现组件级样式隔离，这样符合已定的 CSS 方案决策
22. 作为开发者，我希望 functions/ 和 migrations/ 目录先建立但为空，这样后续阶段不需要再调整目录结构
23. 作为访客，我希望首页展示的内容是真实且可更新的，这样我看到的信息是最新的候选人资料
24. 作为后续阶段的 coding agent，我希望 content/ 的 schema 和目录约定在 CURRENT_STATE.md 里可查，这样我不需要重新探索内容模型
25. 作为后续阶段的 coding agent，我希望 Agent 的 system-prompt 和 answer-rules 已经写好，这样阶段 2 实现 chat 端点时直接读取即可

## Implementation Decisions

### 工程初始化
- 初始化 Astro 到当前目录，保留 `docs/`、`demo/`、`CONTEXT.md`、`AGENTS.md`
- 采用最小模板起步，基于现有 demo 逆向搭建（不使用官方 blog 模板，避免剥离模板样式）
- 建立目录结构：`content/`、`src/pages`、`src/components`、`src/layouts`、`src/styles`、`functions/api`、`public/`、`migrations/`（后三个目录建立但阶段 0 不填充内容）

### Content Collections Schema
项目 frontmatter（定义在 `content/config.ts` 的 Zod schema）：

```yaml
name: string              # 必填
slug: string              # 可选，缺省从文件名生成
tagline: string           # 必填，卡片用一句话说明
type: enum(personal, internship)  # 必填
company: string           # type=internship 时必填，type=personal 时不需要
role: string              # 必填
period: string            # 必填，支持 "2025.12" 或 "2026.02 — 2026.04"
tags: string[]            # 必填
links: object             # 可选，含 github/demo/docs
featured: boolean         # 可选，默认 false
```

refs frontmatter（同一定义或单独 collection）：

```yaml
summary: string           # 必填，一句话摘要，供 Agent 文件索引
```

- `refs/` 不注册为生成路由的 Content Collection（ADR-0003），构建时由自定义脚本读取供阶段 2 的 Agent 上下文使用；阶段 0 只需保证 schema 校验生效
- schema 完整定义见 `docs/CURRENT_STATE.md` "项目 frontmatter schema（已确定）" 一节

### 内容文件
- `content/profile.json`：姓名、联系方式、一句话定位、研究方向、所在地、毕业时间等结构化字段
- `content/resume.json`：教育经历（学校、学位、专业、时间段、主修课程）、实习经历（公司、职位、时间段、子项目 bullet points）、技能栈（按 Agent 架构 / 数据研究 / 产品工程 / 心理学工具分类）、论文（HEART-Bench，放经历里不建项目详情页）
- `content/projects/{slug}/index.md`：每个项目一个目录，frontmatter + 九段式正文（项目背景 / 解决的问题 / 我的职责 / 核心设计 / 技术或工具 / 产出结果 / 难点与复盘 / 可验证材料 / 可追问问题）
- `content/projects/{slug}/refs/*.md`：Agent 参考资料，含 summary frontmatter + 更细的项目内容
- 第一版项目数量：2 个个人项目（Aindexer、角色记忆情境数据构建平台）+ 2 个实习项目（认知科学驱动的 AI 原型研发、记忆系统测试与数据异常分析），共 4 个项目详情页内容
- HEART-Bench 论文放 resume.json 的经历里，不建项目详情页
- 实习项目内容披露边界：可写简历中没有的细节，供 Agent 检索（ADR-0003 的分层信息披露）

### Agent 人格与规则
- `content/agent/system-prompt.md`：落地产品大纲 5.1 节 Agent 定位与推荐说明文案，明确"资料问答助手，不是数字分身"
- `content/agent/answer-rules.md`：落地产品大纲 5.2 节八条回答原则（只根据资料回答 / 资料不足明确说明 / 不编造 / 岗位匹配同时说匹配点风险点 / 不回避短板 / 不披露私人信息 / 不做现实承诺 / 语气专业克制）
- 这两个文件阶段 0 只写内容，不被任何代码读取（阶段 2 的 chat 端点才会读取）

### 样式
- 从 FRONTEND_DESIGN.md 提取 `:root` CSS 变量到 `src/styles/global.css`（颜色 token、基础 reset、字体栈）
- 不引入 Tailwind，组件用 Astro 原生 `<style>` 实现组件级隔离
- 设计 token 严格遵循 FRONTEND_DESIGN.md，不得自创变量

### 首页
- `src/pages/index.astro`：用 Astro 页面重写 demo 首页，读取 `content/profile.json` + `content/resume.json` + Content Collections 项目数据
- 配色对齐 FRONTEND_DESIGN.md 暖白主题（demo 已对齐）
- 布局参考 demo/index.html：固定导航 + 居中 Hero + 关于 + 教育 + 技能云 + 实习经历卡片 + 代表项目卡片 + Agent CTA + Footer
- 组件按 FRONTEND_DESIGN.md 第 9 节最小集合拆分：Nav、SectionHeader、Badge、Button、Card、Tag、Link、Divider

### 保留项
- `demo/index.html` 保留不删除，作为设计参考备份
- `functions/api/`、`public/`、`migrations/` 目录建立但为空

## Testing Decisions

好的测试只验证外部行为，不验证实现细节。阶段 0 引入 Playwright 做端到端渲染测试 + `astro build` 自带 Zod schema 校验做构建测试，按 TDD red-green-refactor 循环推进。

### Seam 1：E2E 渲染测试（Playwright，最高 seam）
对 `astro build` + `astro preview` 的构建产物用 Playwright 查询渲染后的 HTML，验证：
- 首页包含 `content/profile.json` 的候选人姓名
- 首页包含某项目的 tagline
- 修改 tagline 后重新构建，首页内容变化（证明内容驱动真的生效）

### Seam 2：构建时 schema 校验（astro build 退出码）
运行 `astro build`，验证 Zod schema 校验生效：
- 项目缺必填 frontmatter 字段时 build 失败（退出码非零）
- `type` 字段传非 `personal | internship` 值时 build 失败
- `type=internship` 但缺 `company` 时 build 失败
- `refs/*.md` 缺 `summary` 字段时 build 失败

### Seam 3：内容完整性（手动检查）
逐个检查：
- 每个项目的 `index.md` 含九段式标题
- 每个 `refs/*.md` 含 summary frontmatter
- `content/agent/system-prompt.md` 含产品大纲 5.1 节定位文案
- `content/agent/answer-rules.md` 含八条回答原则
- `src/styles/global.css` 的 `:root` 变量与 FRONTEND_DESIGN.md 颜色规范一致

### 不做的事
- 不做视觉回归测试（视觉细节由 FRONTEND_DESIGN.md 约束）
- 不做 Lighthouse 审计（那是阶段 1 全页面完成后的验证）
- 不测组件内部结构或 CSS 具体值

### Prior art
项目当前无测试代码（Astro 工程尚未初始化）。阶段 0 引入 `@astrojs/playwright` 集成，建立 E2E 测试基础设施。Zod schema 校验由 Astro Content Collections 内置提供。

## Out of Scope

- 在线简历页 `/resume`（阶段 1）
- 项目列表页 `/projects` 和项目详情页 `/projects/[slug]`（阶段 1）
- Candidate Agent 页面 `/agent` 和 `/api/chat` 端点（阶段 2）
- 任何 Pages Functions 代码（`functions/api/` 目录建立但为空）
- React Island（Agent 聊天框是阶段 2）
- 数据采集 `/api/track` 和 D1 schema（阶段 3）
- admin 面板（阶段 4）
- 部署上线（阶段 5）
- 视觉回归测试 / Lighthouse 审计（阶段 1）
- 暗色主题（可能后续作为备选，当前以暖白为准）
- FAQ 内容（第一版不做）
- 页面双语（全站中文固定）
- PDF 简历文件放入 public/（阶段 1 才需要下载入口）

## Further Notes

- 阶段 0 完成后应更新 `docs/CURRENT_STATE.md` 的"当前阶段"为"阶段 1 进行中"，补充 Astro 工程结构与默认命令（npm run dev / npm run build）
- 落地时严格遵循 FRONTEND_DESIGN.md 暖白主题，demo 已对齐无需改配色
- 项目 frontmatter schema 完整定义见 `docs/CURRENT_STATE.md`
- 术语遵循 `CONTEXT.md`：模型供应商、当前生效供应商、项目详情页正文、Agent 参考资料、短期记忆
- 相关 ADR：ADR-0001（Astro）、ADR-0003（refs 不公开路由）
- 实习项目内容披露边界：可写非公开细节供 Agent 检索（见问题 11 决策）
- 第一版项目详情页内容数量：4 个（2 个个人项目 + 2 个实习项目），HEART-Bench 论文放 resume.json 经历里
- Agent 的 system-prompt 和 answer-rules 阶段 0 只写内容不被代码读取，阶段 2 的 chat 端点会读取
