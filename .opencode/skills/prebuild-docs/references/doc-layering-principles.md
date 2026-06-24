# 文档分层原则

## 总规则

每一条信息都必须按照它的功能归位。

```text
AGENTS.md               = coding agent 应该如何工作
docs/CURRENT_STATE.md   = 当前项目事实是什么
docs/FRONTEND_DESIGN.md = 前端应保持什么视觉与交互语言
docs/plans/             = 重要方案或关键决策为什么存在
```

## AGENTS.md

`AGENTS.md` 用于存放会影响未来每次 agent 会话的稳定工作规则。

适合写入：

- 编码原则
- 推荐读取顺序
- 仓库级约定
- 验证习惯
- 不确定时的处理方式
- 最小上下文策略

不适合写入：

- 完整 API 字段列表
- 具体 feature 的详细方案
- 临时 bug
- 长篇历史过程
- 局部实现细节

## CURRENT_STATE.md

`CURRENT_STATE.md` 是当前真相快照。

适合写入：

- 当前架构
- 主流程
- 关键入口文件
- canonical 数据结构
- 默认命令
- 默认验证路径
- 容易误判的当前限制

不适合写入：

- changelog
- 已废弃选项
- 旧会议纪要
- 临时 workaround
- 所有局部实现细节

## FRONTEND_DESIGN.md

`FRONTEND_DESIGN.md` 用于记录稳定的前端设计约束。

适合写入：

- 页面整体气质
- 视觉基调
- 色彩、排版、间距、圆角约束
- 核心组件集合
- 状态展示规则
- 表格、表单、差异展示规则
- 动效与响应式边界

不适合写入：

- 某个组件当前 bug
- 某一页接口实现细节
- 高频变化的字段
- 偶然的状态管理技术细节

## docs/plans/

`docs/plans/` 是方案目录，不是杂物箱。

适合写入：

- 项目初版方案
- feature 设计方案
- 架构变更方案
- 核心流程改版方案
- 数据结构改版方案
- 重大 prompt / workflow 调整方案

不适合写入：

- 日常工作记录
- 每次小修改说明
- 临时排障过程
- 与当前项目已经无关的废弃草案
- 已经被 `CURRENT_STATE.md` 覆盖的当前事实
