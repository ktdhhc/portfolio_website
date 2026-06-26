# Issue 013: Agent 流式体验 + 站内入口切换

**阶段**: 阶段 2
**类型**: AFK
**状态**: ready-for-agent

## Parent

`docs/prd/stage-2-candidate-agent-mvp.md`

## What to build

这是阶段 2 的第四个 tracer bullet，补齐用户感知最明显的交互体验，并把站内 Agent 入口从占位切换成真实页面入口。

**SSE 流式输出**：`POST /api/chat` 改为以 SSE 方式返回，让回答逐步出现，而不是长时间等待后一次性跳出全文。

**中间状态展示**：当前端收到工具调用或处理中间状态时，在消息区展示简短状态提示，例如“正在查阅某个项目资料……”，让访客知道 Agent 正在做什么。状态文案应克制，不做花哨 loading。

**站内入口切换**：阶段 2 完成后，站内 Agent 入口从首页 CTA 占位或 `/#agent` 切换为真实 `/agent` 页面。首页 `AgentCTA` 的按钮目标应改为 `/agent`，相关导航入口也应与真实页面保持一致。

## Acceptance criteria

- [ ] `POST /api/chat` 以 SSE 方式返回回答
- [ ] 前端消息区能逐步渲染流式回答
- [ ] 工具调用或处理中间阶段时，页面显示简短状态提示
- [ ] 状态展示遵循 FRONTEND_DESIGN.md：不使用 toast，不阻断浏览
- [ ] 首页 Agent CTA 按钮目标改为 `/agent`
- [ ] 相关导航 / 站内入口与真实 `/agent` 页面保持一致
- [ ] E2E / 集成测试覆盖：流式回答可见 + 中间状态可见 + 入口跳转到 /agent
- [ ] `npm run build` 成功

## Blocked by

- Issue 011（需要 tool-use 主流程先稳定）
