# CURRENT_STATE

## 维护规则

- 防止过度膨胀规则：本文档一般保持在 100-200 行，最多不超过 250 行。写入时先判断是否值得记录、是否可以和已有内容合并、是否应删除旧内容。
- 应写什么：当前仍然有效且会直接影响开发判断的默认事实，如主链流程、关键字段、默认运行方式、关键入口文件、默认验证路径。
- 不应写什么：历史过程、讨论痕迹、未落地方案、一次性 workaround、局部实现细节、两周内很可能再次变化的临时约定。
- 更新触发条件：仅当主流程、默认行为、canonical 字段、关键入口文件或默认验证方式发生稳定变化时更新；普通小改、临时调试和未闭环改动不更新。
- 更新方式：本文件只做覆盖式更新，不追加历史；删除已失效事实，保留当前真相。
- 防漂移要求：每次更新都应尽量短，只保留"新 agent 不知道就容易做错"的内容；若一条信息不能稳定维持一段时间，宁可不写入本文件。

## 文档目的

- 本文件是当前仓库的精简版事实快照。
- 后续 agent 会话应优先阅读本文件。
- 对大多数编码任务，应先读本文件，再只读取直接相关的代码和测试。
- 其他方案文档和历史材料属于补充参考，不应作为默认首读材料。

## 项目一句话说明

面向求职场景的"在线简历容器"：以 Astro 静态页面承载简历与项目展示，以 Candidate Agent 作为可对话的资料辅助层，强调稳定、低维护、边界克制。

## 当前阶段

**阶段 2 无记忆 Agent MVP 已完成**：公开静态页面已完成；`/agent` 页面、`POST /api/chat`、tool-use 资料读取、SSE 流式返回、预设问题和 JD 粘贴分析已接通。Agent 自动化测试 21 个通过，DeepSeek 与 MiMo 真实 provider smoke test 均通过。`/api/chat` 始终返回 SSE（无 JSON 路径），前端实时 markdown 渲染。

阶段 0-1 已交付：
- 产品大纲、个人侧写、前端设计约束（FRONTEND_DESIGN.md）
- 7 个 ADR、5 个领域术语（CONTEXT.md）
- Astro 7 工程初始化（手写 CSS + Astro `<style>` 隔离，无 Tailwind）
- `src/content.config.ts`：Content Collections + Zod schema（含 type=internship 条件必填 refine）
- `content/` 完整建模：profile.json、resume.json、4 个项目（各含 index.md 九段式 + refs/）、agent/（system-prompt + answer-rules）
- 首页 `/`：14 个组件组装，内容全部来自 content/
- `/resume` 简历页：复用 Education/Skills/Experience + 项目索引 + PDF 下载入口（PDF 缺失时显示待补充文案）
- `/projects` 项目列表页：全部项目卡片网格，ProjectCard 含类型/角色/公司/详情链接
- `/projects/[slug]` 项目详情页：九段式正文渲染 + 元信息 + 返回链接，构建时生成静态 HTML
- Nav 统一下拉导航：桌面 hover 自动展开，触屏/键盘可点击展开，支持首页/简历/项目/Agent 切换
- 测试：Playwright E2E + tsx schema 校验；Agent 专项 E2E/API seam 21 个
- Lighthouse 性能审计全部 ≥ 90

阶段 3 待做：数据采集与短期记忆（localStorage UUID + D1 持久化 + 限频 + 埋点）。详见 `docs/plans/initial-implementation-plan.md`。

## 范围边界

- **做**：首页、在线简历页、项目列表页、2-4 个项目详情页、Candidate Agent 页面（含预设问题 + JD 粘贴分析）、基础访问统计、Agent 提问记录、admin 私有面板（数据看板 + 导出 + 清理）
- **暂不做**：用户登录系统、复杂后台、多用户 SaaS、自部署大模型、长期记忆、多 Agent 协作、复杂 RAG、FAQ、页面双语、admin 模型切换 UI、Origin 校验

## 当前架构

```text
- 前端：Astro 7（静态 HTML 为主，Nav/Agent 页面含少量内联 JS；无 React 依赖）— 公开页面与 Agent 页面已实现
- 内容：Content Collections（glob loader + Zod schema），content/ 下 Markdown / JSON，Git 版本管理
- API：Cloudflare Pages Functions（functions/api/chat.ts）— Agent 对话端点已实现；本地开发用 `scripts/pages-dev.ts` 启动 Node harness 服务 dist/ 并转发 `/api/chat` 到同一 Function 入口
- 持久化：Cloudflare D1（埋点、Agent 对话记录、短期记忆）— 待建立
- 模型：外部 LLM API（DeepSeek + MiMo，部署时环境变量切换）
- 部署：Cloudflare Pages，main 分支自动部署，GitHub 私有仓库
- 后台权限：管理员 token（环境变量）
- 测试：Playwright E2E + tsx schema 校验脚本
```

## 主流程关键事实

1. **静态优先**：公开页面（首页/简历/项目列表/项目详情）构建时生成静态 HTML，即使 LLM API、D1 全部宕机仍完整可访问。
2. **内容驱动**：所有个人资料来自 `content/`，Astro Content Collections 用 Zod schema 校验 frontmatter，改文件即改页面。
3. **Agent 渐进式披露**：主上下文只含 system prompt + answer-rules + profile 摘要 + 文件索引。构建时由 `scripts/generate-agent-materials.mjs` 生成 Agent 资料模块，运行时 LLM 通过 `read_file` tool call 读取白名单资料，循环上限 5 轮，流式 SSE 输出 + 中间状态展示。
4. **分层信息披露**：项目 `index.md` 公开可访问生成静态页面；`refs/*.md` 只注入 Agent 上下文，不生成公开路由，访客只能通过 Agent 问答间接获取。
5. **短期记忆**：同一访客（localStorage UUID）24 小时内可见对话上下文延续，超 24 小时访客侧视为新会话；D1 永久保留对话记录供管理者下载。恢复时按 100K token/UUID/天预算截断。
6. **埋点**：页面级（PV + 路径 + 停留时长）+ Agent 级（打开、提问内容、回答状态、模型耗时），sendBeacon 批量 flush，页面卸载前发送。
7. **防滥用**：UUID 限频（20 次/UUID/小时）+ 全局限频（200 轮/天），不做 Origin 校验。

## 分支流程

- **Agent 降级**：LLM API 失败 → 提示"Agent 暂不可用，请查看静态简历和项目页"；D1 失败 → 无记忆模式 + 轻微提示"记忆服务暂时不可用"。
- **admin 流程**：访问 /admin → token 校验 → 数据看板 + 提问记录导出 + 手动清理（按时间范围删/单条删/全清）。

## 当前 UI 结构

首页 `src/pages/index.astro` 已实现，定位为"精选橱窗"：Hero + 1-2 个 featured 项目卡片 + "查看全部项目"链接 + Agent CTA。教育/技能/经历等完整简历内容不在首页展示，移至 `/resume` 页面。设计 token 定义在 `src/styles/global.css`，`.container` 作为全局 utility class。设计原型在 `demo/index.html`（保留作参考）。

导航栏统一使用下拉模式（所有页面一致）："简历"→ 展开教育/经历/技能/PDF 子链接（指向 `/resume#education` 等锚点）；"项目"→ 展开各项目名 + "查看全部"链接（指向 `/projects/[slug]`）；"Agent"链接指向 `/agent/`。桌面端鼠标靠近自动展开；触屏/键盘通过按钮点击/Enter/Space 展开；点击外部或按 Esc 收起。实现为极小内联 JS，不引入额外框架。

页面规划与实现状态：
- `/` 首页 ✅ 已实现：Hero + featured 项目卡片 + 查看全部链接 + Agent CTA（精选橱窗模式）
- `/resume` 在线简历页 ✅ 已实现：教育 + 经历 + 技能 + 项目索引 + PDF 下载入口（缺文件时降级为待补充文案）
- `/projects` 项目列表页 ✅ 已实现：全部项目卡片网格（含类型/角色/公司/详情链接）
- `/projects/[slug]` 项目详情页 ✅ 已实现：九段式正文 + 元信息 + 返回链接
- `/agent` Agent 页面 ✅ 已实现（阶段 2）：聊天 UI + 预设问题 + JD 粘贴分析 + SSE 流式响应 + 实时 markdown 渲染 + tool chip 状态展示 + 思考过程折叠块；当前为无记忆 Agent MVP
- `/admin` 私有面板 ⬜ 待建（阶段 4）

## 关键文件地图

```text
portfolio_website/
├── CONTEXT.md                 # 领域术语表
├── AGENTS.md                  # coding agent 工作规则
├── astro.config.mjs           # Astro 配置
├── playwright.config.ts       # Playwright 配置（webServer: npm run preview）
├── content/                   # 个人资料（已建模）
│   ├── profile.json           # 姓名/联系方式/定位
│   ├── resume.json            # 教育/经历/技能/论文
│   ├── projects/{slug}/       # 4 个项目：aindexer, character-memory, ai-prototype-rd, memory-system-testing
│   │   ├── index.md           # 九段式正文（公开路由）
│   │   └── refs/*.md          # Agent 参考资料（不生成公开路由）
│   └── agent/                 # system-prompt.md + answer-rules.md
├── src/
│   ├── content.config.ts      # Content Collections schema（Zod + refine）
│   ├── pages/index.astro      # 首页（已实现）
│   ├── layouts/Base.astro     # 基础 HTML 布局
│   ├── styles/global.css      # 设计 token + reset + .container utility
│   └── components/            # 14 个 .astro 组件
├── tests/
│   ├── homepage.spec.ts       # 3 个 E2E 渲染测试
│   ├── qa-full.spec.ts        # 33 个 QA 场景测试（P0/P1/P2）
│   └── schema-validation.ts   # 4 个 schema 校验测试（tsx）
├── functions/api/             # Pages Functions：chat.ts（始终 SSE）+ provider 抽象 + read_file tool + 构建时生成资料模块
├── public/                    # 静态资源（resume.pdf 已就位）
├── migrations/                # D1 schema（待建立）
├── docs/
│   ├── 产品大纲.md, personal_profile.md, FRONTEND_DESIGN.md
│   ├── CURRENT_STATE.md       # 本文件
│   ├── adr/                   # 7 个 ADR
│   ├── plans/                 # 实施方案
│   └── prd/, issues/, handoffs/
└── demo/index.html            # 设计原型（保留参考，非生产代码）
```

## 项目 frontmatter schema（已确定）

```yaml
---
name: <项目名>                 # 必填
slug: <URL slug>               # 从文件名生成
tagline: <一句话说明>           # 必填，卡片用
type: personal | internship    # 必填
company: <公司名>              # type=internship 时必填
role: <个人角色>               # 必填
period: <时间段字符串>          # 必填，支持 "2025.12" 或 "2026.02 — 2026.04"
tags: [能力标签]                # 必填
links:                         # 可选
  github: <url>
  demo: <url>
  docs: <url>
featured: true | false         # 可选，默认 false
---
```

`refs/*.md` 的 frontmatter：

```yaml
---
summary: <一句话摘要>           # 必填，供 Agent 文件索引用
---
```

## 工作目录规则

```text
所有命令在仓库根目录执行。
开发：npm run dev（build 后用本地 Node harness 运行 dist/ + /api/chat，默认 http://localhost:4321；若端口占用会自动尝试后续端口）
构建：npm run build（构建到 dist/）
预览：npm run preview（用本地 Node harness 预览 dist/ + /api/chat）
E2E 测试：npm test（Playwright，自动启动 preview 作为 webServer）
schema 测试：npm run test:schema（tsx 脚本，自动 build 验证 frontmatter）
Lighthouse：npm run test:lighthouse（自动 build + preview + 审计 7 个公开静态页面）
全量验证：npm run build && npm test && npm run test:schema && npm run test:lighthouse
```

## 默认验证方式

```text
- 前端页面改动：npm run build + npm run preview 本地预览，确认内容来自 content/ 而非硬编码；涉及 `/api/chat` 时使用默认 `npm run dev` / `npm run preview`，不要使用 `dev:astro` / `preview:astro`
- Content Collections schema：npm run build 时 Zod 校验，字段缺失/类型错会报错；npm run test:schema 用 fixture 跑边界用例
- E2E：npm test 跑 Playwright（覆盖首页/简历/项目/Agent 页面可访问性/内容驱动/导航/hover/触屏/键盘/404/console error；Agent 专项 21 个测试）
- Lighthouse：npm run test:lighthouse 跑 7 个公开静态页面，当前基线为 Performance 100 / Accessibility 95 / Best Practices 96 / SEO 90（全部页面一致，均 ≥ 90）
- Agent 验证：`npm run test:agent-provider` 验证 DeepSeek/MiMo 真实 provider smoke test（解析 SSE 响应）；手动模拟 LLM API 失败确认降级提示正常。D1 失败分支阶段 3 后适用
- 高成本检查：完整 Cloudflare 部署验证，不作为默认快速验证方式
```

## 当前可维护性热点

- 阶段 1 新建页面时复用现有 14 个组件，避免重复造轮子；`.container` 已是全局 class，新组件直接用。
- 设计 token 在 `src/styles/global.css`，组件内样式应使用变量（如 `var(--section-gap)`）而非硬编码值。
- 7 个 ADR 已锁定核心架构决策，落地时如需变更应先评估 ADR 约束。
- `content/` 里的个人资料内容由用户手动维护，agent 不擅自修改内容。
- 安全审查遗留（非阻塞，用户说后面手动调）：公开页面提及内部测试集名称（KnowMe-Bench、CloneMem）可能有 NDA 风险；邮箱含手机号。

## 后续会话约束

- 不要假设历史文档始终完全同步，应优先相信代码和本文件。
- 常规编码任务不要把 ADR 和 plans 当成必读材料，按需读取即可。
- 除非任务明确要求，不要擅自引入新的 frontmatter 字段、API 端点或核心术语。
- 如果任务只涉及一个功能区，只读取该功能区代码、附近测试和对应配置或提示目录。
- 术语使用遵循 `CONTEXT.md`，不要用 `_Avoid_` 列表里的别名。
