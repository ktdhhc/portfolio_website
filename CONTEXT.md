# Portfolio Website

面向求职场景的"在线简历容器"：以静态页面承载简历与项目展示，以 Candidate Agent 作为可对话的资料辅助层。强调稳定、低维护、边界克制。

## Language

**模型供应商（Model Provider）**:
提供 LLM API 服务的厂商，如 DeepSeek、MiMo。代码层通过统一抽象封装，各家供应商实现同一接口。
_Avoid_: 模型厂商、API 提供方、model vendor

**当前生效供应商（Active Provider）**:
当前 Agent 请求实际路由到的那一家供应商。部署时确定，不进数据库，不可运行时切换。
_Avoid_: 默认供应商、当前模型、active model

**项目详情页正文（Project Page Content）**:
项目详情页承载的九段式叙述（背景/问题/职责/设计/技术/结果/复盘/可验证材料/可追问问题），公开可访问，构建时生成对应项目的静态页面。
_Avoid_: 项目描述、project description、project body

**Agent 参考资料（Agent Reference Material）**:
比项目详情页正文更细的项目资料，构建时注入 Agent 上下文，不生成公开路由，访客只能通过 Agent 问答间接获取。
_Avoid_: Agent 知识库、私有项目资料、agent knowledge base、private project material

**短期记忆（Short-Term Memory）**:
同一访客（基于浏览器本地标识）在 24 小时内可见的对话上下文延续。超过 24 小时后，访客侧不再延续历史（视为新会话），但 D1 中的对话记录永久保留供管理者下载分析，不自动删除。区别于长期记忆（跨天以上的持久化，第一版不做）。
_Avoid_: 会话记忆、24h 上下文、session memory、day memory

**JD 粘贴分析（JD Paste Analysis）**:
访客将岗位描述粘贴给 Candidate Agent，请其基于现有简历、项目文档和公开作品资料，分析候选人与该岗位的匹配点、风险点和建议追问。它属于 Candidate Agent 的资料问答能力，不是独立的评测系统或招聘自动化流程。
_Avoid_: JD 评测、岗位打分器、自动筛选、job scoring
