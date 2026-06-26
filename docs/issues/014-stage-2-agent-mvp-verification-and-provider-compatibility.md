# Issue 014: 阶段 2 Agent MVP 验收 + 供应商兼容验证

**阶段**: 阶段 2
**类型**: AFK
**状态**: ready-for-agent

## Parent

`docs/prd/stage-2-candidate-agent-mvp.md`

## What to build

这是阶段 2 的收尾 slice，负责把前面几个 tracer bullet 汇总成一个可交付的无记忆 Candidate Agent MVP，并完成供应商兼容与关键边界回归。

**页面验收**：确认 `/agent` 页面完整可访问，包含定位说明、隐私提示、预设问题、JD 文本域、聊天区、输入框与发送按钮。

**行为验收**：确认普通提问、项目细节问答、预设问题、JD 粘贴分析、失败降级、流式输出与中间状态展示都能工作。

**供应商兼容验证**：用最小 `read_file` 真实示例分别验证 DeepSeek 与 MiMo 都能被同一主流程消费，尤其是 tools / function calling 的响应格式一致性足以支撑当前实现。

**阶段边界回归**：明确本阶段仍是无记忆 MVP，不验证短期记忆、D1 入库、限频与 admin。

## Acceptance criteria

- [ ] `/agent` 页面整体 UI 要素齐全且可访问
- [ ] 普通提问、项目细节问答、预设问题、JD 粘贴分析均可工作
- [ ] LLM API 失败时降级提示可见，页面不崩
- [ ] SSE 流式回答与中间状态展示可见
- [ ] DeepSeek 下最小 `read_file` 真实例子可跑通
- [ ] MiMo 下最小 `read_file` 真实例子可跑通
- [ ] 两家供应商的 tools / function calling 响应格式都能被当前主流程消费
- [ ] 回归验证中明确排除：短期记忆、D1 入库、限频、admin
- [ ] `npm run build` 成功
- [ ] 相关 E2E / 集成测试全部通过

## Blocked by

- Issue 012（预设问题 + JD 粘贴分析）
- Issue 013（流式体验 + 站内入口切换）
