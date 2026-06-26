# Issue 011: Agent 资料读取闭环 + 项目问答边界

**阶段**: 阶段 2
**类型**: AFK
**状态**: ready-for-agent

## Parent

`docs/prd/stage-2-candidate-agent-mvp.md`

## What to build

这是阶段 2 的第二个 tracer bullet，把 Agent 从“能回答”推进到“能基于资料回答正确的问题”。

**主上下文与文件索引**：Agent 常驻主上下文只包含 system prompt、answer-rules、profile 摘要和文件索引，不直接塞全部资料正文。

**tool-use 最小闭环**：实现最小 `read_file` 风格工具。LLM 可按需读取 `resume.json`、各项目 `index.md`（项目详情页正文）和各项目 `refs/*.md`（Agent 参考资料）。后端只允许读取白名单资料文件，不允许任意路径访问。

**项目细节问答**：当访客询问某个项目细节时，Agent 能按需查阅对应资料后回答，而不是只给空泛模板答案。

**边界规则**：
- 资料不足时明确说明无法确认
- 不回答薪资承诺、面试安排、私人敏感信息
- `refs/*.md` 仅通过 Agent 问答间接使用，不生成公开路由边界不被破坏

**5 轮上限**：tool-use 循环总上限固定为 5 轮，超限后强制用已有信息收尾，避免无限循环。

## Acceptance criteria

- [ ] Agent 主上下文仅包含 system prompt、answer-rules、profile 摘要、文件索引
- [ ] 最小 `read_file` 工具可读取 `resume.json`
- [ ] 最小 `read_file` 工具可读取项目 `index.md`
- [ ] 最小 `read_file` 工具可读取项目 `refs/*.md`
- [ ] 后端对白名单外路径拒绝访问
- [ ] 询问项目细节时，Agent 能基于资料回答，不是空泛模板
- [ ] 询问资料外信息时，Agent 明确表示无法确认
- [ ] 询问薪资承诺 / 私人敏感信息时，Agent 拒绝越界回答
- [ ] tool-use 循环上限为 5 轮，超限时服务端能强制收尾
- [ ] 集成测试覆盖：项目细节问答 + 资料不足 + 越界拒答 + 5 轮上限
- [ ] `npm run build` 成功

## Blocked by

- Issue 010（需要 /agent 页面与最小 chat 闭环先跑通）
