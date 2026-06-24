# 初版实施方案

## 1. 背景

本项目方案已通过审讯式讨论确定，产出了 7 个 ADR、5 个领域术语、已更新的产品大纲和 FRONTEND_DESIGN.md。当前状态：demo 已确认设计风格，Astro 工程尚未初始化。本方案描述从零开始到上线的完整工程落地路线。

## 2. 目标

- 建立可运行的 Astro 工程，内容全部由 `content/` 驱动
- 完成全部公开静态页面（首页/简历/项目列表/项目详情）
- 完成 Candidate Agent（渐进式披露 + tool-use + 流式 + 短期记忆）
- 完成数据采集与 admin 私有面板
- 上线 Cloudflare Pages

## 3. 非目标

- 不做 FAQ（第一版不做，等运营数据沉淀）
- 不做页面双语（全站中文固定）
- 不做 admin 模型切换 UI（部署时环境变量切换）
- 不做 Origin 校验（被攻击时全天降级是可接受风险，见 ADR-0007）
- 不做长期记忆（仅 24h 短期记忆）
- 不做 RAG / 向量检索

## 4. 当前约束

- **技术约束**：Astro + Cloudflare Pages + Pages Functions + D1；DeepSeek/MiMo OpenAI 兼容 API；手写 CSS + Astro `<style>` 隔离（不用 Tailwind）
- **产品约束**：静态优先（Agent 不可用时页面仍可用）；低维护（内容走 Markdown/JSON）；数据采集克制（不存完整 IP、不采集硬件指纹）
- **设计约束**：遵循 `docs/FRONTEND_DESIGN.md` 暖白主题（demo 的深色主题不作为配色参考）
- **仓库约束**：GitHub 私有仓库（ADR-0005），main 分支直接部署生产

## 5. 方案概述

按 6 个阶段递进交付，每阶段有明确验证标准。阶段 0-1 可并行推进内容建模与静态页面；阶段 2 依赖阶段 1 的页面骨架；阶段 3-4 依赖阶段 2 的 Agent 端点；阶段 5 收尾上线。

## 6. 实现拆分

### 阶段 0 · 脚手架与内容建模（1-2 天）

- 初始化 Astro 项目到当前目录（保留 docs/、demo/、CONTEXT.md、AGENTS.md）
- 建立目录结构：`content/`、`src/`、`functions/`、`public/`、`migrations/`
- 配置 Content Collections schema（项目 frontmatter：name/slug/tagline/type/company/role/period/tags/links/featured；refs frontmatter：summary）
- 把简历数据抽到 `content/profile.json` + `content/resume.json`
- 把项目内容写成 `content/projects/{slug}/index.md`（九段式）+ `content/projects/{slug}/refs/*.md`（Agent 参考资料，含 summary）
- 写 `content/agent/system-prompt.md` + `content/agent/answer-rules.md`（落地大纲 5.2 节八条回答原则）
- 提炼 FRONTEND_DESIGN.md 的设计 token 到 `src/styles/global.css`
- 首页改用 Astro 页面 + 读取 content，配色切换到暖白主题
- 验证：`astro dev` 本地能跑，首页渲染内容来自 content/，改 JSON 页面随之更新

### 阶段 1 · 静态页面全集（2-3 天）

- 在线简历页 `/resume`：渲染教育、经历、技能、项目索引
- 项目列表页 `/projects`：卡片网格，数据来自 Content Collections
- 项目详情页 `/projects/[slug]`：九段式模板，构建时生成静态页面
- PDF 简历下载（放 `public/resume.pdf`）
- 响应式 + 导航 + 锚点跳转
- 验证：5 个公开页面全部可访问，断网/无 API 时仍完整可用，Lighthouse 性能 ≥ 90

### 阶段 2 · Candidate Agent（2-3 天）

- `functions/api/chat.ts`：拼装 system prompt + answer-rules + profile 摘要 + 文件索引 → 调 LLM → 处理 tool call（读取 content/ 文件）→ 5 轮循环 → 流式 SSE 返回
- 模型供应商抽象层：DeepSeek 与 MiMo 实现同一接口，由 `ACTIVE_PROVIDER` 环境变量决定当前生效供应商
- Agent 页面 React Island：聊天 UI、预设问题按钮（自我介绍/岗位匹配/优势不足/面试问题）、JD 粘贴框（复用 chat 端点，前端拼引导语）
- 流式中间状态展示（"正在查阅 Aindexer 的架构资料..."）
- 失败降级：API 异常时提示查看静态页面
- 隐私提示：输入框附近标注"提问内容可能被记录，请勿输入敏感信息"
- Agent 回答跟随用户提问语言
- 落地时先用最小 `read_file` function 在 DeepSeek/MiMo 两家实测 tool call 响应格式一致（ADR-0004 补充约束）
- 验证：问项目细节能答且不编造；问薪资/私人信息能拒绝；API 挂掉时页面不崩

### 阶段 3 · 数据采集与短期记忆（1-2 天）

- D1 schema：`page_views`（PV + 路径 + 停留时长）、`agent_messages`（uuid + 完整消息序列含 tool call/result + 回答状态 + 耗时）、`app_config`（全局计数器）
- `functions/api/track.ts`：接收前端埋点，sendBeacon 批量上报
- 前端埋点 SDK：页面访问、停留时长，页面卸载前 flush
- 短期记忆：localStorage UUID 生成 + 每次 chat 请求带上；后端按 UUID 关联对话历史；恢复时 100K token/UUID/天预算截断
- D1 降级：D1 不可用时 Agent 退化为无记忆模式 + 轻微提示
- 提问内容永久保存，不做自动脱敏
- 验证：本地访问能产生记录，D1 能查到；D1 断开时 Agent 仍可用且提示降级

### 阶段 4 · admin 私有面板（1-2 天）

- `/admin` 页面：今日/本周访问量、热门页面、下载次数、项目点击排行、Agent 高频问题、失败记录
- 提问记录导出（CSV/JSON）
- 提问记录清理（按时间范围删 + 单条删 + 全清）
- 权限：管理员 token 校验（环境变量），前端访问 /admin 时弹输入框，提交后存 cookie，后续请求带 Authorization header
- `functions/api/admin/stats.ts` + `logs.ts`：聚合查询
- 验证：未授权访问被拦；授权后能看到真实统计数据；导出和清理功能正常

### 阶段 5 · 上线与监控（1 天）

- GitHub 私有仓库初始化，推送代码
- Cloudflare Pages 项目绑定仓库，main 自动部署
- 域名 DNS 配置（域名在别处，改 DNS 指向 Cloudflare Pages）
- 环境变量配置：`DEEPSEEK_API_KEY`、`MIMO_API_KEY`、`ACTIVE_PROVIDER`、`ADMIN_TOKEN`
- 基础监控：Pages 部署日志、Function 错误率
- 验证：生产环境全链路走通，Agent 可用，埋点入库，admin 可访问

## 7. 数据结构 / 接口 / 状态变化

### D1 表（阶段 3 建立）

```text
page_views: id, path, duration_ms, created_at
agent_messages: id, uuid, role, content, tool_call_id, tool_name, created_at
app_config: key, value（全局计数器，如 daily_chat_count）
```

### API 端点

```text
POST /api/chat     — Agent 对话（流式 SSE，含 tool-use 循环）
POST /api/track    — 行为埋点（sendBeacon 批量）
GET  /api/admin/stats  — 私有：统计聚合
GET  /api/admin/logs   — 私有：日志/提问记录查询
```

### 环境变量

```text
DEEPSEEK_API_KEY    — DeepSeek API key
MIMO_API_KEY        — MiMo API key
ACTIVE_PROVIDER     — deepseek | mimo
ADMIN_TOKEN         — admin 面板访问 token
```

## 8. 验证方式

- 阶段 0：`astro dev` 本地预览，确认内容来自 content/ 而非硬编码
- 阶段 1：5 个公开页面手动访问 + Lighthouse 性能审计
- 阶段 2：手动测试 Agent 回答边界（项目细节、薪资、私人信息、JD 分析）；手动模拟 LLM 失败确认降级
- 阶段 3：本地访问产生 D1 记录；手动断开 D1 确认降级
- 阶段 4：未授权访问被拦；授权后数据展示 + 导出 + 清理功能正常
- 阶段 5：生产环境全链路手动走通

## 9. 风险与取舍

- **MiMo 自定义 function calling 文档不完整**：ADR-0004 已记录，落地阶段 2 时需用最小 `read_file` 示例在两家实测。
- **不做 Origin 校验的攻击风险**：ADR-0007 已记录，被攻击时全天 Agent 降级是可接受风险。
- **短期记忆 token 预算截断会丢失早期上下文**：100K token/UUID/天预算下，聊得多的访客会丢早期历史，这是成本与体验的取舍。
- **暗色主题可能作为后续备选**：当前 demo 为暖白主题，后续可能新增暗色主题，落地时以暖白为准，暗色作为可选切换。

## 10. 何时更新 CURRENT_STATE

仅当本方案已落地并改变主流程、默认行为、canonical 字段、关键入口或默认验证方式时，才更新 `docs/CURRENT_STATE.md`。

具体触发点：
- 阶段 0 完成：更新"当前阶段"为"阶段 1 进行中"，补充 Astro 工程结构与默认命令
- 阶段 1 完成：更新 UI 结构为已实现的页面列表
- 阶段 2 完成：补充 Agent 端点与降级路径为已验证事实
- 阶段 5 完成：更新"当前阶段"为"已上线"，补充生产环境验证方式
