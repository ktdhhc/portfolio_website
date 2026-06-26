# Issue 010: Agent 最小问答闭环 + 失败降级

**阶段**: 阶段 2
**类型**: AFK
**状态**: ready-for-agent

## Parent

`docs/prd/stage-2-candidate-agent-mvp.md`

## What to build

这是阶段 2 的第一个 tracer bullet，先交付一个**无记忆、可单次提问、失败可降级**的 Candidate Agent 最小闭环。

**/agent 页面**：新建独立的 Agent 页面，而不是继续停留在首页 CTA 占位。页面需包含：Candidate Agent 的定位说明、隐私提示、消息区、单行输入框、发送按钮。页面本身可访问，即使 Agent 接口失败也不能变成死路。

**POST /api/chat 最小闭环**：新建 chat 端点，先支持最简单的一次提问 → 一次回答流程。本 slice 的目标是把“页面能发问、后端能调当前生效供应商、前端能显示回答”这条主链路跑通。当前保持**无记忆**：不恢复历史上下文，不读写 D1，不做限频。

**失败降级**：当 LLM API 失败或后端异常时，对话区域显示降级提示：“Agent 暂不可用，请查看静态简历和项目页。” 页面其余部分仍可正常浏览。

**语言跟随**：Agent 回答应跟随用户提问语言。

**E2E / 集成验证**：`/agent` 返回 200；页面出现定位说明与隐私提示；发送一个普通问题后能出现回答；模拟 LLM 失败时能看到降级提示。

## Acceptance criteria

- [ ] `/agent` 返回 200
- [ ] `/agent` 页面包含 Candidate Agent 定位说明
- [ ] `/agent` 页面包含隐私提示“提问内容可能被记录，请勿输入敏感信息”
- [ ] `/agent` 页面包含消息区、单行输入框、发送按钮
- [ ] `POST /api/chat` 支持最小单次提问 → 单次回答闭环
- [ ] Agent 回答跟随用户提问语言
- [ ] 本 slice 保持无记忆：不恢复历史、不接 D1、不做限频
- [ ] 模拟 LLM API 失败时，对话区显示降级提示，页面不崩
- [ ] E2E / 集成测试覆盖：/agent 可访问 + 普通提问成功 + 降级路径可见
- [ ] `npm run build` 成功

## Blocked by

None — 可以立即开始
