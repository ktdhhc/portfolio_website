# Portfolio Website

面向求职场景的"在线简历容器"：以 Astro 静态页面承载简历与项目展示，以 Candidate Agent 作为可对话的资料辅助层。

## 技术栈

- **前端框架**：Astro 5（默认零 JS 静态输出，Agent 聊天框用 React Island）
- **样式**：手写 CSS + Astro 原生 `<style>` 组件级隔离，不引入 Tailwind
- **内容管理**：Markdown / JSON，通过 Content Collections + Zod schema 校验
- **API**：Cloudflare Pages Functions（规划中）
- **数据库**：Cloudflare D1（规划中）
- **模型**：外部 LLM API（DeepSeek + MiMo，部署时环境变量切换）
- **部署**：Cloudflare Pages，GitHub 私有仓库，main 分支自动部署
- **测试**：Playwright（E2E）+ tsx 脚本（schema 校验）

## 环境要求

- Node.js >= 18（当前开发环境 v22）
- npm >= 9

## 安装

```bash
npm install
```

依赖安装在项目本地 `node_modules/`，不污染全局环境。

## 常用命令

```bash
# 开发服务器（http://localhost:4321）
npm run dev

# 构建静态站点到 dist/
npm run build

# 预览构建产物（http://localhost:4321）
npm run preview

# 运行 Playwright E2E 测试（需先 build）
npm test

# 运行 schema 校验测试（自动 build 验证 frontmatter）
npm run test:schema

# Playwright UI 模式
npm run test:ui
```

## 测试

项目有两类测试，互不干扰：

- **E2E 测试**（`tests/*.spec.ts`，Playwright）：验证首页渲染内容来自 `content/` 文件。运行前 Playwright 会自动启动 `npm run preview` 作为 webServer。
- **Schema 校验测试**（`tests/schema-validation.ts`，tsx 脚本）：用临时 fixture 文件验证 Content Collections 的 Zod schema 校验生效（缺字段 / 非法 type / 条件必填 / refs summary）。不碰真实 content 文件。

```bash
# 跑全部测试
npm run build && npm test && npm run test:schema
```

## 项目结构

```
portfolio_website/
├── content/                    # 个人资料（Git 管理）
│   ├── profile.json            # 姓名/联系方式/定位
│   ├── resume.json             # 教育/经历/技能（待建立）
│   ├── projects/
│   │   └── {slug}/
│   │       ├── index.md        # 项目详情页正文（九段式）
│   │       └── refs/           # Agent 参考资料（不生成公开路由）
│   └── agent/
│       ├── system-prompt.md    # Agent 人格与边界（待建立）
│       └── answer-rules.md     # 回答规则（待建立）
├── src/
│   ├── pages/                  # Astro 路由
│   ├── components/             # 复用组件
│   ├── layouts/                # 基础布局
│   ├── styles/                 # 全局样式
│   └── content.config.ts       # Content Collections schema（Zod）
├── functions/api/              # Cloudflare Pages Functions（待建立）
├── public/                     # 静态资源（PDF 简历等）
├── migrations/                 # D1 schema（待建立）
├── tests/                      # 测试
│   ├── homepage.spec.ts        # E2E 渲染测试
│   └── schema-validation.ts    # schema 校验脚本
├── docs/                       # 文档
│   ├── 产品大纲.md
│   ├── personal_profile.md
│   ├── FRONTEND_DESIGN.md      # 前端稳定设计约束
│   ├── CURRENT_STATE.md        # 当前项目事实快照
│   ├── adr/                    # 7 个架构决策记录
│   ├── plans/                  # 实施方案
│   ├── prd/                    # PRD
│   └── issues/                 # Issue 跟踪
├── demo/                       # 设计原型（非生产代码）
├── CONTEXT.md                  # 领域术语表
├── AGENTS.md                   # coding agent 工作规则
├── astro.config.mjs
├── playwright.config.ts
├── tsconfig.json
└── package.json
```

## Content Collections Schema

项目 frontmatter（`content/projects/{slug}/index.md`）：

```yaml
---
name: string              # 必填
slug: string              # 可选，缺省从文件名生成
tagline: string           # 必填，卡片用一句话说明
type: personal | internship  # 必填
company: string           # type=internship 时必填
role: string              # 必填
period: string            # 必填
tags: string[]            # 必填
links:                    # 可选
  github: url
  demo: url
  docs: url
featured: boolean         # 可选，默认 false
---
```

Agent 参考资料 frontmatter（`content/projects/{slug}/refs/*.md`）：

```yaml
---
summary: string           # 必填，供 Agent 文件索引
---
```

构建时 Zod schema 校验，字段缺失或类型错误会在 `npm run build` 报错。

## 环境变量

部署时通过 Cloudflare Secrets 注入，不进代码仓库：

| 变量 | 用途 |
|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `MIMO_API_KEY` | MiMo API key |
| `ACTIVE_PROVIDER` | 当前生效供应商：`deepseek` \| `mimo` |
| `ADMIN_TOKEN` | admin 面板访问 token |

## 文档导航

- **新会话首选读**：`docs/CURRENT_STATE.md`（当前事实快照）
- **术语参考**：`CONTEXT.md`（领域术语表）
- **前端约束**：`docs/FRONTEND_DESIGN.md`（稳定设计规范）
- **架构决策**：`docs/adr/`（7 个 ADR）
- **工作规则**：`AGENTS.md`（coding agent 操作指南）
- **实施方案**：`docs/plans/initial-implementation-plan.md`
- **阶段 0 PRD**：`docs/prd/stage-0-scaffold-and-content-model.md`

## 当前状态

阶段 0 进行中：Astro 工程已初始化，Content Collections schema 已建立，Aindexer 项目内容已建模，E2E + schema 测试跑通。剩余工作见 `docs/issues/`。

详细当前事实见 `docs/CURRENT_STATE.md`。
