# 输出契约

使用本 skill 时，应为目标项目生成以下文档文件。

## 必需文件

```text
AGENTS.md
docs/CURRENT_STATE.md
docs/FRONTEND_DESIGN.md
docs/plans/README.md
```

## 可选文件

仅在确实有用时，建议或生成 1-3 个文件：

```text
docs/plans/initial-project-plan.md
docs/plans/frontend-redesign-plan.md
docs/plans/core-flow-plan.md
docs/plans/data-structure-plan.md
docs/plans/prompt-workflow-plan.md
```

## 输出模式

如果环境允许写入文件：

- 直接创建文件。
- 列出生成路径。
- 列出尚未解决的占位符。

如果环境不能写入文件：

- 按文件路径分别输出。
- 每个文件单独标注路径。
- 不要把分析过程混入文件正文。

## 占位符策略

用占位符代替没有证据支持的判断：

```text
<pending>
<repo-root>
<backend-dir>
<frontend-dir>
<current-stage>
<main-entry-file>
```

不要把猜测写成事实。
