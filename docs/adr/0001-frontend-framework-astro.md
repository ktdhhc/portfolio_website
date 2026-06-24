# ADR-0001: 前端框架选用 Astro

## 状态

accepted

## 上下文

本产品是一份面向求职场景的"在线简历容器"，产品大纲明确要求"公开页面尽量静态化，避免因为后端、模型 API、数据库或 Agent 服务异常导致简历主体不可访问"，同时"低维护优先，内容更新通过 Markdown / JSON 完成"。

前端框架需要同时满足：静态优先（SEO、首屏速度、稳定）、Markdown/JSON 内容驱动、以及局部交互能力（Agent 聊天框、JD 粘贴分析）。

候选方案：

- **Astro** — 默认零 JS 静态输出，Content Collections 原生支持 Markdown/JSON schema，按需 React Island 承载交互。
- **Next.js** — 全功能框架，SSR/ISR 能力强，但对简历站是过度设计；在 Cloudflare Pages 上需要 `@cloudflare/next-on-pages` 适配层，增加部署复杂度。
- **Vite + React** — 纯 SPA，最简单但首屏白屏、SEO 弱，违背"稳定优先"。

## 决策

采用 **Astro** 作为前端框架。

Agent 聊天框等需要交互的部分以 React Island 形式按需加载，其余页面保持零 JS 静态 HTML 输出。

## 理由

1. **匹配核心原则**：默认零 JS 静态输出直接满足"稳定优先"——即使 LLM API、D1 全部宕机，公开简历页面仍是完整可访问的静态 HTML。
2. **匹配内容组织方式**：Astro Content Collections 原生对应产品大纲 9.2 节的 `content/` 目录结构，改 Markdown/JSON 即改页面，Git 管理版本，零后台成本。
3. **可逆性低**：框架一旦选定，页面结构、内容 schema、部署配置都围绕它建立，迁移成本高，值得记录。
4. **存在真实权衡**：Next.js 在动态功能上更强、生态更大，是合理替代；选择 Astro 是基于"静态优先 + 低维护"的产品定位主动放弃了一部分动态能力。
