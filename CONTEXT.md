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

**访客标识（Visitor UUID）**:
浏览器本地保存的随机 UUID，用于 Agent 提问记录归类、行为事件关联和 UUID 级限频。它是访客侧可重置的标识，不基于 IP 或设备指纹。
_Avoid_: session id、memory uuid、user id、设备指纹

**行为事件（Behavior Event）**:
访客在站点内发生的一次可记录交互，例如页面浏览、下载、点击、打开 Agent 或触发外链跳转。它用于后台统计与行为归类，不等同于 Agent 对话记录。
_Avoid_: page view、点击埋点、track row、analytics hit

**Agent 问答轮次（Agent Turn）**:
访客一次提交及 Agent 对应的一次最终回答。它是 Agent 对话记录的基本单位，用于统计、导出和失败归类，不等同于逐条消息或中间状态事件。
_Avoid_: message row、单条消息、请求日志、逐字流片段

**Agent 会话（Agent Session）**:
访客一次进入 `/agent` 页面后形成的一段连续聊天。它用于日志分组、导出和后台查看，不等同于访客标识，也不表示跨时间窗口的上下文延续。
_Avoid_: 24h 记忆、memory session、visitor uuid、聊天恢复窗口

**Tool Trace**:
一次 Agent 问答轮次内，Agent 为完成回答而触发的工具使用摘要，例如调用次数、读取过哪些资料文件、是否发生工具失败。它用于排查和统计，不等同于工具返回内容全文。
_Avoid_: 完整工具结果、tool dump、原始文件镜像

**JD 粘贴分析（JD Paste Analysis）**:
访客将岗位描述粘贴给 Candidate Agent，请其基于现有简历、项目文档和公开作品资料，分析候选人与该岗位的匹配点、风险点和建议追问。它属于 Candidate Agent 的资料问答能力，不是独立的评测系统或招聘自动化流程。
_Avoid_: JD 评测、岗位打分器、自动筛选、job scoring
