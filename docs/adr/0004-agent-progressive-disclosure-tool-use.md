# ADR-0004: Agent 采用渐进式披露 + tool-use 架构

## 状态

accepted

## 上下文

Candidate Agent 需要基于候选人资料（profile、resume、项目详情页正文、Agent 参考资料）回答访客问题。产品大纲明确"RAG：暂不上"。

候选方案：

- **全量塞 system prompt**：构建时把所有 content 拼成大 system prompt，每次请求都带。简单，但 Token 量大，随项目增多会爆。
- **按需选择上下文（规则匹配）**：运行时用关键词/项目名匹配决定带哪些内容。Token 省，但匹配逻辑脆弱，无法应对模糊提问。
- **渐进式披露 + tool-use**：主上下文只含 system prompt + answer-rules + profile 摘要 + 文件索引（文件名 + 摘要）。LLM 自主决定读哪个文件，发起 tool call，系统读取完整文件返回，LLM 基于完整内容继续生成。

## 决策

采用**渐进式披露 + tool-use 架构**：

1. 常驻主上下文：system prompt、answer-rules、profile 摘要、文件索引（每个文件的路径 + 一句话摘要）
2. LLM 自主决定读取哪些文件，发起 tool call
3. `functions/api/chat.ts` 接收 tool call，读取对应文件完整内容返回
4. LLM 基于完整内容生成回答，可继续发起下一轮 tool call
5. **tool-use 循环上限 5 轮**，超过强制让 LLM 用已有信息收尾

## 理由

1. **Token 经济**：主上下文只含索引而非全文，常规问题不触发文件读取，成本可控。
2. **应对模糊提问**：LLM 自主选择文件，比关键词规则匹配更能处理"你那个文献项目大概是怎么做检索的"这类无明确项目名的提问。
3. **天然支持跨项目查询**：LLM 可连续读取多个项目文件做对比，受 5 轮上限约束。
4. **符合"暂不上 RAG"**：不引入向量数据库、embedding，只用 LLM 原生 tool-use 能力，复杂度可控。
5. **可演进**：未来资料量增大到 LLM 选不准文件时，可加一层 embedding 检索做"文件索引"的增强，tool-use 主循环不变。

## 代价

- 实现复杂度高于全量塞 system prompt：需要实现 tool 定义、tool call 调度、文件读取、轮数计数。
- 响应延迟取决于 LLM 决策速度 + 文件读取轮数，比单轮请求慢。
- 依赖 LLM 的 tool-use 能力质量，弱模型可能选错文件。

## 供应商兼容性确认

- **DeepSeek**：完整支持 OpenAI 兼容的自定义 function calling，含 `strict` 模式。
- **MiMo（小米）**：支持。证据：OpenAI 兼容 API + 文档明确"可与自定义 Function 协同使用" + `tools` 参数格式与 OpenAI 一致。MiMo 文档未单独提供自定义 Function 页面，落地时需用最小 `read_file` 示例在两家实测确认响应格式一致。
