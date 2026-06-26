# 适用范围

本文件适用于位于 `D:\1project\portfolio_website` 的整个仓库。

将其作为在本仓库中工作的 coding agent 的默认操作指南。

## 一、全局 Agent 原则

以下原则适用于整个仓库。
如果本文件后续章节提供了更具体的项目规则，则以更具体的规则为准。

### 1. 编码前先思考

不要想当然。不要掩饰困惑。要把权衡摆到明面上。

在开始实现之前：

- 明确说明你的假设。如果不确定，就提问。
- 如果存在多种理解方式，把它们都说出来，不要默默选一种。
- 如果有更简单的方法，就直接指出来。必要时要敢于提出异议。
- 如果有不清楚的地方，就先停下来。说明到底哪里令人困惑，并提出澄清问题。

### 2. 简单优先

只写解决问题所需的最少代码。不做任何猜测性扩展。

- 不添加任何超出要求的功能。
- 不为一次性代码做抽象。
- 不加入未被要求的"灵活性"或"可配置性"。
- 不为极不现实的场景编写额外错误处理。
- 如果 50 行就能完成，就不要保留 200 行实现。

问问自己：一个优秀工程师会不会觉得这份实现过度复杂？
如果答案是会，那就继续简化。

本项目的"简单优先"有额外含义：产品大纲明确要求**低维护优先**。任何增加长期维护负担的复杂度（复杂状态管理、重型依赖、过度抽象的组件体系）都应主动避免。

### 3. 外科手术式修改

只改必须改的地方。只清理由你自己改动引发的问题。

在修改现有代码时：

- 不要"顺手优化"邻近代码、注释或格式。
- 不要重构那些本来没坏的东西。
- 要匹配现有局部风格，即使你自己平时会写成另一种样子。
- 如果注意到无关的死代码，可以指出，但不要直接删除，除非被明确要求。

当你的改动制造出"孤儿内容"时：

- 删除那些因你的改动而变得未使用的 import、变量、函数。
- 不要删除原本就存在的死代码，除非用户明确要求。

检验标准：每一行修改，都应该能够直接追溯到用户请求。

### 4. 以目标驱动执行

先定义成功标准。然后持续推进，直到验证通过。

把任务转化为可验证的目标：

- "添加校验" → 先为非法输入编写测试，再让这些测试通过。
- "修复这个 bug" → 先写或确认复现方式，再让复现失效。
- "重构 X" → 保持行为不变，并通过有针对性的验证确认。

对于多步骤任务，先给出一个简短计划：

```text
1. [步骤] → 验证：[检查方式]
2. [步骤] → 验证：[检查方式]
3. [步骤] → 验证：[检查方式]
```

### 5. 失败可降级

本项目核心设计原则之一是"失败可降级"（见产品大纲第二节）。实现任何涉及外部依赖的功能时，必须考虑依赖不可用时的降级行为：

- LLM API 不可用 → Agent 提示访客查看静态简历和项目页
- D1 不可用 → Agent 降级为无记忆模式 + 轻微错误提示
- 埋点上报失败 → 静默失败，不影响页面浏览
- 后台不可用 → 不影响公开页面

不要为实现方便而省略降级路径。

## 二、个性开发习惯

### 1. 开发与验证习惯

- 本项目为单体 Astro 工程，前端与 Pages Functions 在同一仓库。
- 开发命令在仓库根目录执行：`npm run dev`（build 后用本地 Node harness 运行 dist/ + `/api/chat`，默认 http://localhost:4321，端口占用时自动递增）。不要用 `npm run dev:astro`，它不服务 Pages Functions。
- 前端文件避免全部写在同一个大文件里；增加新组件或新功能前，先判断是否应拆成新文件。
- 优先运行有针对性的验证，而不是默认做全量重跑。
- 高成本集成检查（如完整 Cloudflare 部署验证）不应作为默认快速验证方式。

### 2. 代码风格约束

- **前端（Astro 页面与组件）**：
  - 使用 Astro 原生 `<style>` 标签实现组件级样式隔离，全局变量与 reset 放 `src/styles/global.css`。
  - 不引入 Tailwind 或其他 CSS 框架（见 ADR 后续决策，CSS 方案为手写 + Astro `<style>` 隔离）。
  - 设计 token（颜色、间距、圆角）严格遵循 `docs/FRONTEND_DESIGN.md`，不得自创变量。
  - 内容来自 `content/` 目录的 Markdown / JSON，页面不得硬编码个人资料。
- **后端（Pages Functions）**：
  - API 路由放 `functions/api/`，保持精简，业务逻辑抽到独立模块。
  - 模型供应商通过统一抽象封装，DeepSeek 与 MiMo 实现同一接口（见 CONTEXT.md "模型供应商"）。
  - 当前生效供应商由环境变量决定，不可运行时切换（见 ADR-0002）。
  - Agent 采用渐进式披露 + tool-use 架构，tool-use 循环上限 5 轮（见 ADR-0004）。

这些原则偏向谨慎而不是速度。
对于非常简单的任务，可以自行判断，不必机械执行。

## 三、项目总体背景

- 产品类型：面向求职场景的在线简历容器，含 Candidate Agent 辅助问答层。
- 核心目标：让面试官快速理解候选人，让候选人了解访客关注点，同时保持系统稳定、克制、低维护。
- 主要价值：以静态页面承载简历与项目展示，以 Agent 作为可对话的资料辅助层；即使 Agent 不可用，主页本身必须完整承担简历展示功能。
- 当前定位：个人求职作品集，非 SaaS、非多用户平台、非 AI 分身产品。
- 当前边界：
  - 不做用户登录系统、复杂后台、多用户 SaaS
  - 不做自部署大模型、长期记忆、多 Agent 协作、复杂 RAG
  - 不做招聘自动化、自动爬取更新简历
  - 第一版不做 FAQ、不做页面双语

## 四、相对稳定的仓库结构

```text
portfolio_website/
├── CONTEXT.md                 # 领域术语表（glossary），不含实现细节
├── AGENTS.md / CLAUDE.md      # coding agent 工作规则（两份需保持同步）
├── content/                   # 所有个人资料，Git 管理
│   ├── profile.json           # 姓名/联系方式/定位等结构化字段
│   ├── resume.json            # 教育经历/工作经历/技能栈
│   ├── projects/              # 每个项目一个目录
│   │   └── {slug}/
│   │       ├── index.md       # 项目详情页正文（frontmatter + 九段式）
│   │       └── refs/          # Agent 参考资料，不生成公开路由
│   │           └── *.md
│   └── agent/
│       ├── system-prompt.md   # Agent 人格与边界
│       └── answer-rules.md    # 回答规则
├── src/                       # Astro 源码
│   ├── pages/                 # 路由（index/resume/projects/[slug]/agent）
│   ├── components/            # 复用组件
│   ├── layouts/               # 基础布局
│   └── styles/                # 全局样式
├── functions/                 # Cloudflare Pages Functions
│   └── api/
│       ├── chat.ts            # Agent 对话接口（始终返回 SSE）
│       ├── _providers/        # 供应商抽象（DeepSeek/MiMo/fake）
│       ├── _tools/            # read_file tool（白名单读取）
│       └── _generated/        # 构建时生成的 Agent 资料模块
├── scripts/                   # 构建/开发/验证脚本
│   ├── generate-agent-materials.mjs  # 构建前生成 Agent 资料模块
│   ├── pages-dev.ts           # 本地 Node harness（服务 dist/ + /api/chat）
│   └── verify-agent-provider.ts      # 真实 provider smoke test
├── public/                    # 静态资源（PDF 简历等）
├── migrations/                # D1 schema（待建立）
├── docs/                      # 文档
│   ├── 产品大纲.md             # 产品定位与边界
│   ├── personal_profile.md    # 候选人个人侧写
│   ├── FRONTEND_DESIGN.md     # 前端稳定设计约束
│   ├── CURRENT_STATE.md       # 当前项目事实快照
│   ├── adr/                   # 架构决策记录
│   │   ├── 0001-frontend-framework-astro.md
│   │   ├── 0002-model-provider-switch-deploy-time.md
│   │   ├── 0003-agent-reference-material-not-public.md
│   │   ├── 0004-agent-progressive-disclosure-tool-use.md
│   │   ├── 0005-private-repository.md
│   │   ├── 0006-agent-session-localstorage-uuid-24h.md
│   │   └── 0007-agent-rate-limit-uuid-global-no-origin.md
│   └── plans/                 # 实施方案
│       └── initial-implementation-plan.md
└── demo/                      # 设计原型（HTML），非生产代码）
    ├── index.html
    └── agent.html
```

## 五、主流程与分支的稳定认知

- **主流程**：访客访问静态页面（首页/简历/项目） → 可选发起 Agent 对话 → Agent 通过 tool-use 按需读取 content/ 资料 → 回答流入对话区。埋点在页面卸载前批量上报。
- **关键分支**：
  - Agent 降级分支：LLM API 失败 → 提示查看静态页面；D1 失败 → 无记忆模式 + 轻微提示。
  - admin 分支：token 校验 → 数据看板 + 导出 + 清理。
- **不应轻易改动的约定**：
  - `content/` 目录是唯一的内容源，页面不得硬编码个人资料。
  - `refs/` 不生成公开路由，只注入 Agent 上下文（ADR-0003）。
  - 仓库保持私有（ADR-0005）。
  - 前端设计 token 遵循 `docs/FRONTEND_DESIGN.md`，不得自创。

## 六、文档目录与读取建议

### 默认优先读取

#### docs/CURRENT_STATE.md

- 用途：当前仓库的"当前真相"快照。
- 内容：当前有效架构、已确定边界、demo 现状、关键入口、默认验证方式。
- 读取时机：后续 agent 会话默认优先阅读。
- 注意：保持短、小、稳，只记录当前仍然有效的事实。

#### CONTEXT.md（根目录）

- 用途：项目领域术语表（glossary）。
- 内容：模型供应商、当前生效供应商、项目详情页正文、Agent 参考资料、短期记忆等核心术语定义。
- 读取时机：涉及项目特定概念时阅读，避免术语混用。

#### docs/FRONTEND_DESIGN.md

- 用途：前端页面结构、视觉基调、交互边界与组件实现方向的规范说明。
- 读取时机：任务涉及前端页面、样式、布局、交互组织时再读取。

### 按需读取

#### docs/产品大纲.md

- 用途：产品定位、核心功能范围、MVP 边界。
- 读取时机：需要确认产品边界或功能范围时。

#### docs/adr/

- 用途：7 个架构决策记录，记录难逆决策的上下文、决策与理由。
- 读取时机：需要理解某项技术选型的原因、或考虑变更架构时。

#### docs/plans/

- 适合在实现具体 feature 或回看设计方案时按需读取。
- 不应作为默认首读材料。

## 七、推荐读取顺序

对于大多数日常开发任务，推荐使用下面的最小读取顺序：

1. 先读 `docs/CURRENT_STATE.md`，了解当前项目事实。
2. 需要确认术语时读 `CONTEXT.md`。
3. 再读与当前任务直接相关的代码文件。
4. 只有任务涉及前端表现时，再读 `docs/FRONTEND_DESIGN.md`。
5. 只有需要理解架构决策原因时，再读 `docs/adr/` 中相关 ADR。
6. 只有需要历史背景或方案依据时，再读 `docs/plans/` 中的相关文档。

## 八、使用原则

- 优先相信代码和 `docs/CURRENT_STATE.md` 中仍然有效的事实。
- 不要把历史文档和方案文档当作默认最小上下文。
- 如果当前任务只涉及一个功能区，只读该功能区代码、测试和必要文档。
- 保持低上下文、强边界、局部验证的开发方式，避免无必要的全仓重读。
- 术语使用遵循 `CONTEXT.md`，不要用 `_Avoid_` 列表里的别名。

## 九、Agent 修改检查清单

- 修改行为前，先阅读被触及模块及其附近测试。
- 在发明新的命名和载荷结构之前，先匹配现有命名和数据形状。
- 修改 `content/` 下资料后，确认 Astro Content Collections schema 校验通过。
- 修改 Agent 相关逻辑后，确认降级路径仍可用（LLM 失败、D1 失败）。
- 修改前端样式时，确认未违背 `docs/FRONTEND_DESIGN.md` 的稳定约束。
- 先运行最小必要验证，再逐步扩大检查范围。
- 任何新增公开路由都要确认不泄露 `refs/` 内容（ADR-0003）。

## 十、仓库级约定

- **仓库保持私有**（ADR-0005）：`content/` 含 Agent 参考资料、个人简历、Agent system prompt，不可公开。不要建议开源、不要在公开渠道分享仓库内容。
- **部署方式**：main 分支推送到 GitHub 私有仓库后，Cloudflare Pages 自动部署到生产。不做 PR 预览流程，误推靠 Cloudflare Pages 部署历史一键回滚。
- **环境变量**：LLM API key、admin token 等通过 Cloudflare Secrets 注入，不进代码仓库、不进 D1。

## 十一、不确定时

- 优先做最小、局部的改动，而不是大范围重写。
- 保持行为可追溯、关键证据可保留、流程可恢复。
- 保持文档与行为一致；如果重大工作流假设发生变化，更新 `docs/CURRENT_STATE.md` 或相关文档。
- 如果遇到本文件、ADR、产品大纲之间矛盾，以最新更新的一方为准；若无法判断，向用户提问。
