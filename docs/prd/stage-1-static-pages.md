# PRD: 阶段 1 — 静态页面全集

**状态**: ready-for-agent
**所属阶段**: 阶段 1（静态页面全集）
**上游约束**: ADR-0001（Astro 静态优先）、ADR-0003（refs 不公开路由）、CONTEXT.md 术语、FRONTEND_DESIGN.md 设计约束、CURRENT_STATE.md frontmatter schema、阶段 0 已完成的工程脚手架与内容模型

---

## Problem Statement

阶段 0 已建立 Astro 工程脚手架、Content Collections schema、完整的内容模型和首页，但**公开页面只有首页一个**。访客无法浏览完整在线简历、无法查看项目列表、无法进入单个项目详情页阅读九段式叙述。首页的导航仍是单页锚点跳转，无法引导访客到其他页面。

候选人需要一份"即使 Agent 不可用也完整成立"的在线简历容器，这意味着所有简历与项目内容必须以静态页面形式独立存在，不依赖任何后端或模型 API。当前只有首页，缺口是 `/resume`、`/projects`、`/projects/[slug]` 三个页面，以及跨页面导航和 PDF 下载入口。

## Solution

在阶段 0 已有的工程基础上，新建 3 个静态页面（`/resume` 简历页、`/projects` 项目列表页、`/projects/[slug]` 项目详情页），改造导航从单页锚点变为多页面链接，提供 PDF 简历下载入口，并补充 E2E 测试覆盖全部 5 个公开页面。

完成后，访客可以从首页导航到完整简历页、浏览全部项目卡片、进入任意项目详情页阅读九段式正文，全程不依赖 Agent 或后端。所有页面内容来自 `content/`，改 Markdown / JSON 即改页面。构建时生成静态 HTML，断网仍完整可访问。

## User Stories

### 在线简历页 /resume

1. 作为访客，我希望访问 /resume 能看到完整简历内容，这样即使 Agent 不可用我也能独立了解候选人全部背景
2. 作为访客，我希望简历页包含教育经历，这样我能了解候选人的学历背景
3. 作为访客，我希望简历页包含工作/实习经历，这样我能了解候选人的职业经历
4. 作为访客，我希望简历页包含技能栈，这样我能快速判断技术匹配度
5. 作为访客，我希望简历页包含项目索引并链接到项目详情页，这样我能从简历直接跳转到感兴趣的项目
6. 作为访客，我希望简历页有 PDF 下载入口，这样我能保存一份离线简历
7. 作为访客，我希望简历页在没有 Hero 大标题的情况下仍有页面标题表明这是简历页，这样页面身份清晰
8. 作为访客，我希望简历页的布局与首页视觉风格一致（暖白主题、单栏、留白充分），这样浏览体验连贯
9. 作为开发者，我希望简历页复用首页已有的 Education、Skills、Experience 组件，这样不重复造轮子
10. 作为开发者，我希望简历页的数据来自 content/resume.json 和 Content Collections，这样内容驱动机制一致

### 项目列表页 /projects

11. 作为访客，我希望访问 /projects 能看到所有项目的卡片列表，这样我能概览候选人做过的全部项目
12. 作为访客，我希望每张项目卡片显示项目名称，这样我能识别每个项目
13. 作为访客，我希望每张项目卡片显示一句话说明（tagline），这样我能快速理解项目做什么
14. 作为访客，我希望每张项目卡片显示项目类型（个人项目 / 实习项目），这样我能区分项目性质
15. 作为访客，我希望每张项目卡片显示个人角色，这样我知道候选人在项目中负责什么
16. 作为访客，我希望每张项目卡片显示时间段，这样我知道项目是什么时候做的
17. 作为访客，我希望每张项目卡片显示核心能力标签，这样我能判断项目涉及的技术栈
18. 作为访客，我希望每张项目卡片有"查看详情"入口链接到项目详情页，这样我能深入阅读
19. 作为访客，我希望实习项目卡片显示公司名称，这样我知道项目是在哪家公司做的
20. 作为访客，我希望项目卡片如果有 GitHub/Demo/文档链接能直接点击，这样我能查看外部资料
21. 作为访客，我希望项目列表页在移动端也能正常浏览，卡片纵向堆叠不拥挤
22. 作为开发者，我希望项目列表页的数据来自 Content Collections 的全部项目，这样不限于首页的 featured 筛选

### 项目详情页 /projects/[slug]

23. 作为访客，我希望通过 URL `/projects/aindexer` 能直接访问 Aindexer 项目详情页，这样我能分享或直接定位某个项目
24. 作为访客，我希望项目详情页按九段式结构展示正文（项目背景 → 解决的问题 → 我的职责 → 核心设计 → 技术或工具 → 产出结果 → 难点与复盘 → 可验证材料 → 可追问问题），这样信息结构清晰一致
25. 作为访客，我希望项目详情页顶部显示项目元信息（名称、类型、角色、时间段、标签、链接），这样我在阅读正文前有上下文
26. 作为访客，我希望项目详情页的正文是渲染后的 Markdown（含标题、段落、列表、代码块），这样阅读体验良好
27. 作为访客，我希望项目详情页有返回项目列表的链接，这样我能回到列表浏览其他项目
28. 作为访客，我希望访问不存在的项目 slug 时看到 404 页面，这样不会遇到空白或报错
29. 作为开发者，我希望项目详情页在构建时为每个项目生成静态 HTML，这样不需要运行时渲染
30. 作为开发者，我希望 refs/*.md 不会被生成公开路由，这样 Agent 参考资料不泄露（ADR-0003）
31. 作为开发者，我希望项目详情页只渲染 index.md 的正文，refs/ 内容不出现在公开页面，这样分层信息披露边界明确

### 导航与跨页面

32. 作为访客，我希望导航栏的链接能跳转到不同页面（首页、简历、项目），这样我能自由切换
33. 作为访客，我希望点击导航的"项目"能跳转到 /projects 页面，这样不限于首页的项目 section
34. 作为访客，希望在导航栏点击“简历”可以跳转到 /resume 页面，这样我能找到完整简历
35. 作为访客，我希望导航栏在所有页面保持固定顶部 + 毛玻璃效果，这样滚动时导航始终可见
36. 作为访客，我希望在首页点击导航的"关于"/"教育"等仍能滚动到首页对应区块，这样首页的锚点体验不丢失
37. 作为访客，我希望移动端导航链接隐藏时不影响页面浏览，这样小屏幕不被导航挤占空间
38. 作为开发者，我希望导航组件支持区分"页面级链接"和"首页锚点链接"两种模式，这样首页和其他页面能复用同一组件

### PDF 下载

39. 作为访客，我希望首页 Hero 的"下载简历"按钮能下载 PDF 文件，这样我能保存离线版本
40. 作为访客，我希望 /resume 页面也有 PDF 下载入口，这样从简历页也能直接下载
41. 作为开发者，我希望 PDF 文件放在 public/ 目录由用户手动提供，这样不需要代码生成

### 测试与质量

42. 作为开发者，我希望 E2E 测试覆盖全部 5 个公开页面可访问（HTTP 200），这样任何页面构建失败能立即发现
43. 作为开发者，我希望 E2E 测试验证 /projects 页面展示全部项目卡片，这样内容驱动的完整性被守护
44. 作为开发者，我希望 E2E 测试验证项目详情页能从 /projects 点击进入，这样页面间导航不断链
45. 作为开发者，我希望 E2E 测试验证访问不存在的项目 slug 返回 404，这样路由边界被覆盖
46. 作为开发者，我希望 E2E 测试验证 /resume 页面内容来自 content/ 而非硬编码，这样内容驱动机制一致
47. 作为开发者，我希望 E2E 测试验证移动端视口下页面可浏览，这样响应式不被破坏
48. 作为开发者，我希望 Lighthouse 性能审计 ≥ 90，这样静态页面的性能基线被守住

## Implementation Decisions

### 页面级路由

- `/resume` — 新建静态页面，渲染完整简历内容，数据来自 `content/resume.json` + Content Collections 项目索引
- `/projects` — 新建静态页面，渲染全部项目卡片网格，数据来自 Content Collections（不限于 featured）
- `/projects/[slug]` — 新建动态路由，构建时为每个项目生成静态 HTML，渲染 index.md 的九段式正文 + frontmatter 元信息
- 首页 `/` 保持不变，但导航组件需改造

### /resume 页面结构

- 复用阶段 0 已有组件：Education、Skills、Experience（数据来自 resume.json）
- 新增项目索引区：列出所有项目名称 + tagline + 链接到 `/projects/[slug]`，数据来自 Content Collections
- PDF 下载入口：链接到 `/resume.pdf`（public/ 下的静态文件）
- 不含 Hero 和 Agent CTA（设计约束：Hero 仅首页，Agent CTA 仅首页）
- 使用 SectionHeader 标注各区块，视觉风格与首页一致
- 布局沿用 Base.astro 布局 + Nav + Footer

### /projects 页面结构

- 使用 SectionHeader 标题 + 项目卡片网格
- 卡片网格单栏布局（FRONTEND_DESIGN.md 第 8 节：单栏为主），移动端纵向堆叠
- 每张卡片展示：项目名称、tagline、项目类型（个人/实习）、个人角色、时间段、能力标签、外链（GitHub/Demo/文档）、"查看详情"链接
- 实习项目卡片额外显示公司名称
- 数据来自 `getCollection('projects')` 全部项目，不筛选 featured

### ProjectCard 组件增强

当前 ProjectCard 展示 name/tagline/period/tags/links，需补充：
- 项目类型（type 字段）：以 Badge 形式展示"个人项目"或"实习项目"
- 个人角色（role 字段）：在卡片中展示
- 公司名称（company 字段）：type=internship 时展示
- "查看详情"链接：指向 `/projects/[slug]`
- 查看详情链接需要 slug，来自 Content Collections 的 entry id

### /projects/[slug] 详情页结构

- 顶部元信息区：项目名称、类型、角色、时间段、标签、外链
- 正文区：渲染 index.md 的 Markdown 内容（九段式：项目背景 → 解决的问题 → 我的职责 → 核心设计 → 技术或工具 → 产出结果 → 难点与复盘 → 可验证材料 → 可追问问题）
- 底部返回链接：回到 /projects
- 使用 Astro 的 `render()` 或 `<Content />` 渲染 Markdown
- 构建时 `getStaticPaths()` 为每个项目生成静态路径
- 不存在的 slug → Astro 自动 404

### refs/ 不公开路由（ADR-0003 约束）

- Content Collections 只注册 `projects` collection（指向 `content/projects` 的 `index.md`）
- `refs/*.md` 不注册为生成路由的 collection，只供阶段 2 的 Agent 上下文读取
- 项目详情页只渲染 index.md 正文，refs/ 内容不出现在任何公开页面

### 导航组件改造

当前 Nav 是纯锚点导航（#about, #education, #experience, #projects, #agent），需改为支持两种模式：
- **页面级链接**：首页指向 `/`、`/resume`、`/projects`、`/agent`（agent 页面阶段 2 才建，先占位或指向首页 Agent CTA）
- **首页锚点**：在首页时，"关于"/"教育"/"经历"/"项目"仍滚动到首页对应 section
- 实现方式：Nav 接收 `currentPage` prop 判断当前页面，首页用锚点链接，其他页面用页面级链接
- 移动端导航链接继续隐藏（FRONTEND_DESIGN.md 第 16 节：MVP 可暂不实现汉堡菜单）

### PDF 简历

- PDF 文件由用户手动提供，放在 `public/resume.pdf`
- 首页 Hero 的"下载简历"按钮和 /resume 页面的下载入口都指向 `/resume.pdf`
- 阶段 1 不做 PDF 生成代码，只做下载链接

### Base.astro 布局复用

- 所有新页面复用阶段 0 的 Base.astro 作为 HTML 外壳
- Nav 和 Footer 在所有页面一致出现
- 页面 `<title>` 通过 Base 的 prop 传入

### 视觉一致性

- 所有新页面使用 global.css 的设计 token，不硬编码颜色/间距
- `.container` 全局 utility class 直接使用
- Section 间距 `--section-gap`（8rem），卡片内边距 `--card-padding`，圆角 `--radius-card`
- hover 交互遵循 FRONTEND_DESIGN.md 第 15 节：仅颜色/透明度变化，0.2s 过渡

## Testing Decisions

好的测试只验证外部行为，不验证实现细节。阶段 1 在阶段 0 已有的 Playwright E2E 基础上扩展，覆盖新增页面的可访问性、内容驱动、导航、响应式。

### Seam 1：E2E 页面可访问性（Playwright，最高 seam）

对 `astro build` + `astro preview` 的构建产物，用 Playwright 验证：
- `/` 首页返回 200 且包含候选人姓名（已有测试，保留）
- `/resume` 返回 200 且包含教育/经历/技能内容
- `/projects` 返回 200 且包含全部项目卡片（4 个项目）
- `/projects/aindexer` 返回 200 且包含九段式正文标题
- `/projects/nonexistent` 返回 404

### Seam 2：E2E 内容驱动验证（Playwright）

- `/resume` 页面的教育内容来自 `content/resume.json`（验证学校名出现）
- `/projects` 页面展示全部项目（验证 4 个项目名称都出现）
- `/projects/[slug]` 详情页正文来自 index.md（验证九段式标题出现）

### Seam 3：E2E 导航验证（Playwright）

- 首页导航"简历"链接指向 `/resume`
- 首页导航"项目"链接指向 `/projects`
- /projects 页面项目卡片"查看详情"链接指向 `/projects/[slug]`
- 项目详情页有返回 /projects 的链接
- 首页锚点导航（关于/教育/经历）仍能滚动到对应 section

### Seam 4：E2E 移动端（Playwright）

- 移动端视口（375px）下 /resume、/projects、/projects/[slug] 页面可浏览
- 移动端导航链接隐藏
- 项目卡片纵向堆叠

### Seam 5：构建完整性（astro build 退出码）

- `npm run build` 成功，生成的 dist/ 包含 5 个公开页面 + 4 个项目详情页

### Seam 6：Lighthouse 性能审计

- 对 5 个公开页面跑 Lighthouse，性能分 ≥ 90
- 使用 Playwright 的 Lighthouse 集成或手动跑

### 不做的事

- 不做视觉回归测试（视觉细节由 FRONTEND_DESIGN.md 约束）
- 不测组件内部 CSS 具体值
- 不测 PDF 文件内容（只测下载链接存在）

### Prior art

- `tests/homepage.spec.ts`：3 个首页 E2E 渲染测试（阶段 0 建立）
- `tests/qa-full.spec.ts`：33 个 QA 场景测试（阶段 0 建立）
- `tests/schema-validation.ts`：4 个 schema 校验测试（阶段 0 建立）
- Playwright 配置在 `playwright.config.ts`，webServer: `npm run preview`

## Out of Scope

- Candidate Agent 页面 `/agent` 和 `/api/chat` 端点（阶段 2）
- Agent 聊天 UI、预设问题、JD 粘贴框（阶段 2）
- React Island（阶段 2 才需要）
- 任何 Pages Functions 代码（阶段 2-4）
- 数据采集 `/api/track` 和 D1 schema（阶段 3）
- admin 面板 `/admin`（阶段 4）
- 部署上线（阶段 5）
- PDF 文件生成代码（用户手动提供 PDF，本阶段只做下载链接）
- 暗色主题（以暖白为准）
- FAQ 内容（第一版不做）
- 页面双语（全站中文固定）
- 汉堡菜单移动端导航（MVP 可暂不实现，FRONTEND_DESIGN.md 第 16 节）
- 搜索功能
- 项目筛选/排序

## Further Notes

- 阶段 1 完成后应更新 `docs/CURRENT_STATE.md` 的 UI 结构部分，将 /resume、/projects、/projects/[slug] 标记为已实现
- 所有新页面严格遵循 FRONTEND_DESIGN.md 暖白主题和组件最小集合
- ProjectCard 组件增强后需向后兼容——首页的 Projects section 仍能用同一组件
- 导航组件改造需同时兼容首页（锚点模式）和其他页面（页面链接模式）
- refs/*.md 不公开路由的约束由 Content Collections 只注册 projects collection 保证（阶段 0 已配置）
- 术语遵循 `CONTEXT.md`：项目详情页正文、Agent 参考资料
- 相关 ADR：ADR-0001（Astro 静态优先）、ADR-0003（refs 不公开路由）
- PDF 文件命名 `resume.pdf`，放在 `public/`，用户在阶段 1 实现前或验收前手动放入
- `/agent` 导航链接阶段 1 先指向首页 Agent CTA section（`/#agent`），阶段 2 再改为 `/agent` 页面
