# 004 · Agent 人格与规则文档

**状态**: ready-for-agent
**Type**: AFK
**Parent PRD**: docs/prd/stage-0-scaffold-and-content-model.md

## What to build

写 `content/agent/system-prompt.md` 和 `content/agent/answer-rules.md` 两个内容文件。system-prompt 落地产品大纲 5.1 节的 Agent 定位与推荐说明文案，明确"资料问答助手，不是数字分身"。answer-rules 落地产品大纲 5.2 节的八条回答原则。

这两个文件阶段 0 只写内容，不被任何代码读取（阶段 2 的 chat 端点才会读取并拼装进 Agent 上下文）。作为独立可验证的内容交付物，对照产品大纲 5.1/5.2 节检查完整性。

可与 #002 并行推进。

## Acceptance criteria

- [ ] `content/agent/system-prompt.md` 含 Agent 定位描述（资料问答助手，不是数字分身）
- [ ] `content/agent/system-prompt.md` 含产品大纲 5.1 节的推荐说明文案（"这个 Agent 基于我的简历、项目文档和公开作品资料构建..."）
- [ ] `content/agent/system-prompt.md` 明确 Agent 不应承担的事项（不承诺薪资/不安排面试/不表达求职意向/不回答私人敏感信息/不编造经历/不代替真实面试沟通）
- [ ] `content/agent/answer-rules.md` 含产品大纲 5.2 节的八条回答原则：
  - [ ] 1. 只根据候选人提供的资料回答
  - [ ] 2. 资料不足时明确说明无法确认
  - [ ] 3. 不编造职位、成果、数据、合作方或项目影响力
  - [ ] 4. 面对岗位匹配问题时，同时说明匹配点、风险点和建议追问
  - [ ] 5. 面对质疑时，不回避短板
  - [ ] 6. 不披露私人信息
  - [ ] 7. 不替候选人做现实承诺
  - [ ] 8. 语气专业、克制、清晰
- [ ] answer-rules 补充"Agent 回答跟随用户提问语言"的规则（见审讯式讨论问题 29 决策）
- [ ] 两个文件用 Markdown 写，结构清晰可读，后续阶段 2 的 chat 端点能直接读取拼装

## Blocked by

- #001（依赖已建立的 content/ 目录结构）
