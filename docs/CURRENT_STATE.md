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

**阶段 0 准备期**：方案与设计已确定，demo 已确认设计风格，Astro 工程尚未初始化。

已就绪：
- 产品大纲、个人侧写、前端设计约束（FRONTEND_DESIGN.md）
- 7 个 ADR、5 个领域术语（CONTEXT.md）
- 1 份设计原型（demo/index.html，暖白主题，已对齐 FRONTEND_DESIGN.md）

未开始：
- Astro 工程初始化
- content/ 内容模型建立
- 任何 src/ 或 functions/ 代码

## 范围边界

- **做**：首页、在线简历页、项目列表页、2-4 个项目详情页、Candidate Agent 页面（含预设问题 + JD 粘贴分析）、基础访问统计、Agent 提问记录、admin 私有面板（数据看板 + 导出 + 清理）
- **暂不做**：用户登录系统、复杂后台、多用户 SaaS、自部署大模型、长期记忆、多 Agent 协作、复杂 RAG、FAQ、页面双语、admin 模型切换 UI、Origin 校验

## 当前架构

```text
- 前端：Astro（默认零 JS 静态输出，Agent 聊天框用 React Island）— 待初始化
- API：Cloudflare Pages Functions（functions/api/）— 待建立
- 持久化：Cloudflare D1（埋点、Agent 对话记录、短期记忆）— 待建立
- 模型：外部 LLM API（DeepSeek + MiMo，部署时环境变量切换）
- 内容管理：content/ 下的 Markdown / JSON，Git 版本管理
- 部署：Cloudflare Pages，main 分支自动部署，GitHub 私有仓库
- 后台权限：管理员 token（环境变量）
```

## 主流程关键事实

1. **静态优先**：公开页面（首页/简历/项目列表/项目详情）构建时生成静态 HTML，即使 LLM API、D1 全部宕机仍完整可访问。
2. **内容驱动**：所有个人资料来自 `content/`，Astro Content Collections 用 Zod schema 校验 frontmatter，改文件即改页面。
3. **Agent 渐进式披露**：主上下文只含 system prompt + answer-rules + profile 摘要 + 文件索引（文件名 + 手写 summary）。LLM 自主发起 tool call 读取完整文件，循环上限 5 轮，流式 SSE 输出 + 中间状态展示。
4. **分层信息披露**：项目 `index.md` 公开可访问生成静态页面；`refs/*.md` 只注入 Agent 上下文，不生成公开路由，访客只能通过 Agent 问答间接获取。
5. **短期记忆**：同一访客（localStorage UUID）24 小时内可见对话上下文延续，超 24 小时访客侧视为新会话；D1 永久保留对话记录供管理者下载。恢复时按 100K token/UUID/天预算截断。
6. **埋点**：页面级（PV + 路径 + 停留时长）+ Agent 级（打开、提问内容、回答状态、模型耗时），sendBeacon 批量 flush，页面卸载前发送。
7. **防滥用**：UUID 限频（20 次/UUID/小时）+ 全局限频（200 轮/天），不做 Origin 校验。

## 分支流程

- **Agent 降级**：LLM API 失败 → 提示"Agent 暂不可用，请查看静态简历和项目页"；D1 失败 → 无记忆模式 + 轻微提示"记忆服务暂时不可用"。
- **admin 流程**：访问 /admin → token 校验 → 数据看板 + 提问记录导出 + 手动清理（按时间范围删/单条删/全清）。

## 当前 UI 结构

设计原型在 `demo/index.html`，已对齐 `docs/FRONTEND_DESIGN.md` 的暖白主题（bg #faf8f5，accent #d4a574），居中 Hero + 单栏卡片布局，含导航、Hero、关于、教育、技能、实习经历、代表项目、Agent CTA、Footer。后续可能更新一版暗色主题作为备选，落地时以当前暖白主题为准。

页面规划：
- `/` 首页：Hero + 核心能力 + 技能 + 代表项目 + Agent CTA
- `/resume` 在线简历页：教育 + 经历 + 技能 + 项目索引 + PDF 下载
- `/projects` 项目列表页：卡片网格
- `/projects/[slug]` 项目详情页：九段式
- `/agent` Agent 页面：聊天 UI + 预设问题 + JD 粘贴框
- `/admin` 私有面板（第二阶段）

## 关键文件地图

```text
portfolio_website/
├── CONTEXT.md                 # 领域术语表
├── AGENTS.md                  # coding agent 工作规则
├── content/                   # 个人资料（待建立）
├── src/                       # Astro 源码（待建立）
├── functions/api/             # Pages Functions（待建立）
├── public/                    # 静态资源（待建立）
├── migrations/                # D1 schema（待建立）
├── docs/
│   ├── 产品大纲.md             # 产品定位与边界
│   ├── personal_profile.md    # 候选人侧写
│   ├── FRONTEND_DESIGN.md     # 前端稳定设计约束
│   ├── CURRENT_STATE.md       # 本文件
│   ├── adr/                   # 7 个 ADR
│   └── plans/                 # 实施方案
└── demo/index.html            # 设计原型（深色，仅参考布局）
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
开发：npm run dev（Astro dev，待初始化后生效）
构建：npm run build（待初始化后生效）
当前无可用命令（Astro 工程尚未初始化）。
```

## 默认验证方式

```text
- 前端页面改动：astro dev 本地预览，确认内容来自 content/ 而非硬编码
- Content Collections schema：构建时 Zod 校验，字段缺失/类型错会报错
- Agent 降级路径：手动模拟 LLM API / D1 失败，确认降级提示正常
- 当前无测试框架（待初始化后补充）
- 高成本检查：完整 Cloudflare 部署验证，不作为默认快速验证方式
```

## 当前可维护性热点

- Astro 工程尚未初始化，所有 `src/`、`functions/`、`content/` 路径均为规划态。
- 7 个 ADR 已锁定核心架构决策，落地时如需变更应先评估 ADR 约束。
- 后续可能新增暗色主题 demo 作为备选，落地时以当前暖白主题为准。

## 后续会话约束

- 不要假设历史文档始终完全同步，应优先相信代码和本文件。
- 常规编码任务不要把 ADR 和 plans 当成必读材料，按需读取即可。
- 除非任务明确要求，不要擅自引入新的 frontmatter 字段、API 端点或核心术语。
- 如果任务只涉及一个功能区，只读取该功能区代码、附近测试和对应配置或提示目录。
- 术语使用遵循 `CONTEXT.md`，不要用 `_Avoid_` 列表里的别名。
