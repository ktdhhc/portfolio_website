# Handoff: Portfolio Website 项目（阶段 0 完成）

**生成时间**: 2026-06-25
**项目路径**: D:\1project\portfolio_website
**当前阶段**: 阶段 0 已完成，阶段 1 待启动

---

## 项目是什么

面向求职场景的"在线简历容器"：Astro 静态页面承载简历与项目展示 + Candidate Agent 作为可对话的资料辅助层。强调稳定、低维护、边界克制。

## 当前状态

阶段 0（脚手架 + 内容建模 + 首页）已完成并通过用户验收。Astro 工程可运行、可构建、可测试。40 个测试全绿（36 E2E + 4 schema）。

### 已建立的工程结构

```
portfolio_website/
├── src/
│   ├── content.config.ts       # Content Collections schema（Zod，含 refine 条件校验）
│   ├── pages/index.astro       # 首页（组装所有 section）
│   ├── layouts/Base.astro      # 基础 HTML 布局
│   ├── styles/global.css       # 设计 token + reset + .container utility class
│   └── components/             # 14 个独立 .astro 组件
│       Nav, Hero, Badge, Button, About, SectionHeader,
│       Education, Skills, Tag, Experience, Projects,
│       ProjectCard, AgentCTA, Footer
├── content/
│   ├── profile.json            # 候选人基本信息
│   ├── resume.json             # 教育/实习/技能/论文
│   ├── agent/
│   │   ├── system-prompt.md    # Agent 人格（产品大纲 5.1）
│   │   └── answer-rules.md     # 八条回答原则 + 跟随用户语言
│   └── projects/
│       ├── aindexer/           # index.md（九段式）+ refs/（2个补充资料）
│       ├── character-memory/   # index.md + refs/
│       ├── ai-prototype-rd/    # index.md（实习）+ refs/
│       └── memory-system-testing/ # index.md（实习）+ refs/
├── tests/
│   ├── homepage.spec.ts        # 3 个 E2E 渲染测试
│   ├── qa-full.spec.ts         # 33 个 QA 场景测试（QA agent 遗留产出）
│   └── schema-validation.ts    # 4 个 schema 校验测试（tsx 脚本）
├── functions/api/              # 空目录，阶段 2 填充
├── public/                     # 空目录，阶段 1 放 PDF
├── migrations/                 # 空目录，阶段 3 填充
├── docs/                       # 完整文档体系（见下方）
└── demo/index.html             # 设计原型（保留，暖白主题已对齐 FRONTEND_DESIGN.md）
```

### 常用命令

```bash
npm run dev          # 开发服务器 localhost:4321
npm run build        # 构建到 dist/
npm run preview      # 预览构建产物
npm test             # Playwright E2E（36 个）
npm run test:schema  # schema 校验（4 个）
```

## 关键文档索引（不在本文件重复内容，按路径引用）

| 文档 | 路径 | 用途 |
|------|------|------|
| 当前事实快照 | `docs/CURRENT_STATE.md` | **新会话首读**，当前有效架构、边界、frontmatter schema |
| 领域术语表 | `CONTEXT.md` | 5 个术语：模型供应商、当前生效供应商、项目详情页正文、Agent 参考资料、短期记忆 |
| coding agent 工作规则 | `AGENTS.md` | 开发规则、读取顺序、仓库约定 |
| 前端设计约束 | `docs/FRONTEND_DESIGN.md` | 暖白主题、设计 token、组件最小集合、交互边界 |
| 产品大纲 | `docs/产品大纲.md` | 产品定位、MVP 范围、Agent 边界 |
| ADR 0001-0007 | `docs/adr/` | 7 个架构决策（Astro / 供应商切换 / refs 不公开 / tool-use / 私有仓库 / 短期记忆 / 限频） |
| 初版实施方案 | `docs/plans/initial-implementation-plan.md` | 阶段 0-5 落地路线 |
| 阶段 0 PRD | `docs/prd/stage-0-scaffold-and-content-model.md` | 已完成的 PRD |
| Issue 001-005 | `docs/issues/` | 5 个 issue（001-004 已完成，005 验收待用户确认） |

## 已锁定的关键决策（ADR 摘要）

1. **ADR-0001**: Astro，默认零 JS 静态输出，Agent 聊天框用 React Island
2. **ADR-0002**: 模型供应商（DeepSeek + MiMo）部署时环境变量切换，不做 admin 运行时切换
3. **ADR-0003**: refs/*.md 不生成公开路由，只注入 Agent 上下文（分层信息披露）
4. **ADR-0004**: Agent 渐进式披露 + tool-use 架构，5 轮上限，流式 SSE
5. **ADR-0005**: 仓库保持私有（GitHub 私有仓库）
6. **ADR-0006**: 短期记忆 localStorage UUID + 24h，D1 永久存储供下载，100K token/UUID/天预算截断
7. **ADR-0007**: 防滥用 UUID 限频（20次/小时）+ 全局限频（200轮/天），不做 Origin 校验

## 待处理事项

### 阶段 0 收尾
- **Issue #005（HITL）**: 用户已口头验收"没有发现明显问题"，但 CURRENT_STATE.md 尚未更新为"阶段 1 进行中"。需补充 Astro 工程结构、默认命令、UI 结构为已实现状态。
- **安全审查发现（非阻塞，用户说后面手动调）**: 实习项目公开页面提及内部测试集名称（KnowMe-Bench、CloneMem）可能有 NDA 风险；邮箱含手机号。

### 阶段 1（下一个工作单元）
按 `docs/plans/initial-implementation-plan.md` 阶段 1：
- 在线简历页 `/resume`
- 项目列表页 `/projects`
- 项目详情页 `/projects/[slug]`（九段式渲染）
- PDF 简历下载（放 public/）
- 响应式 + 导航 + 锚点
- 验证：5 个公开页面可访问，Lighthouse ≥ 90

### 骨架修复已完成
本次会话末尾修复了 3 个结构性问题：
- `.container` 从 9 个组件重复定义提取到 global.css 全局 utility class
- Hero 间距从硬编码改为 CSS 变量（`--hero-padding-top` 等）
- `.gitignore` 加了 `.opencode/` 和 `.omo/`

## 技术栈

- Astro 7（静态 SSG）+ Content Collections（Zod schema）
- 手写 CSS + Astro `<style>` 隔离（不用 Tailwind）
- Playwright E2E + tsx schema 脚本
- 部署目标：Cloudflare Pages + Pages Functions + D1（后续阶段）
- 模型：DeepSeek + MiMo（OpenAI 兼容 API，tool-use 已确认两家都支持）

## 建议的技能

新会话开始时，建议按需加载以下技能：

- **`/prebuild-docs`**: 如果需要重构文档体系
- **`/tdd`**: 阶段 1 实现新页面时，继续 red-green-refactor 循环
- **`/grill-with-docs`**: 如果阶段 1 开始前需要澄清新的边界问题
- **`/to-issues`**: 如果需要把阶段 1 拆分成 issue
- **`/review-work`**: 阶段 1 完成后做代码审查（注意：Oracle agent 大输入会超时，建议拆小 prompt 或用 unspecified-high agent）
- **`/handoff`**: 再次生成 handoff 文档

## 新会话快速启动指南

1. 读 `docs/CURRENT_STATE.md` 了解当前事实
2. 读 `CONTEXT.md` 确认术语
3. 读 `AGENTS.md` 了解工作规则
4. 跑 `npm run build && npm test && npm run test:schema` 确认环境正常
5. 如果做阶段 1：读 `docs/plans/initial-implementation-plan.md` 的阶段 1 部分 + `docs/FRONTEND_DESIGN.md`
6. 如果涉及架构变更：先读相关 ADR

## 注意事项

- content/ 里的个人资料内容用户说"后面手动调"，不需要 agent 改内容
- Oracle agent 在处理大文件输入时会静默超时（review-work 的已知限制），如需审查建议拆小 prompt
- QA agent 超时但遗留了 `tests/qa-full.spec.ts`（33 个测试），有价值，保留
- `package.json` 里 astro 是 `^7.0.2`，安装时可能装到更高版本，注意锁定
