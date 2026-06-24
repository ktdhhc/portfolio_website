---
name: prebuild-docs
description: 在软件项目已有初步方案、即将进入开发，或已经有一版可运行 demo 时使用本 skill。它用于为项目生成或重构低噪音、可维护、便于后续 coding agent 接手的分层上下文文档体系，主要产出 AGENTS.md、docs/CURRENT_STATE.md、docs/FRONTEND_DESIGN.md 和 docs/plans/。不要用于普通 README 写作、更新日志、临时调试记录、日常工作日志或宣传文案。
---

# Prebuild Docs Skill

## 目的

为软件项目建立一套可维护的分层上下文文档系统，让后续 coding agent 能在新会话中用更少上下文快速接手项目。

本 skill 不负责写宣传材料，也不负责堆叠项目介绍。它的任务是把项目事实、稳定约束和重要方案分层沉淀到少量职责清晰的文件中。

## 适用场景

当用户请求满足以下任一条件时，使用本 skill：

- 项目概念或初步实现方案已经基本确定，准备进入正式开发。
- 项目已经有可运行 demo，需要从现有实现中沉淀稳定事实。
- 用户希望后续 coding agent 在新会话中快速接手仓库。
- 用户希望建立低噪音、可维护、可持续更新的项目文档体系。
- 用户明确要求生成或重构 `AGENTS.md`、`docs/CURRENT_STATE.md`、`docs/FRONTEND_DESIGN.md` 或 `docs/plans/`。

## 不适用场景

不要将本 skill 用于：

- 普通产品 README 写作。
- 面向展示或宣传的项目介绍。
- 简单 changelog 更新。
- 临时排障记录。
- 日常工作日志。
- 没有可执行方案、没有仓库事实、也没有稳定约束的早期想法。

## 输入优先级

优先从以下材料中提取信息：

- 项目 README。
- 现有仓库目录结构。
- 已有 demo 的实际行为。
- 当前运行命令。
- 后端和前端关键入口文件。
- 设计说明、PRD、任务拆解或架构草图。
- 测试、脚本、页面结构、API 路由摘要、稳定字段定义。

如果输入信息不完整，使用显式占位符，不要把猜测写成事实。

## 输出契约

为目标项目生成标准文档包：

1. `AGENTS.md`
2. `docs/CURRENT_STATE.md`
3. `docs/FRONTEND_DESIGN.md`
4. `docs/plans/README.md`
5. 视情况建议 1-3 个 `docs/plans/` 下的初始方案文档文件名

如果当前环境支持写入文件，应直接创建文件并列出生成路径。如果只能输出文本，应按文件路径分别提供内容，不要把分析过程混进文件正文。

## 工作流

### 1. 判断项目成熟度

先把项目归入以下两类之一：

```text
A. 方案刚确定，代码很少或尚未开发
B. 已有一版可运行 demo 或原型
```

对于 A 类项目：

- `AGENTS.md` 偏重开发规则、文档约定和读取顺序。
- `docs/CURRENT_STATE.md` 保持较短，只写已确定的范围、架构和边界。
- `docs/FRONTEND_DESIGN.md` 可相对完整，作为后续实现约束。

对于 B 类项目：

- `AGENTS.md` 应包含仓库阅读顺序和修改原则。
- `docs/CURRENT_STATE.md` 应从现有实现中提炼当前稳定真相。
- `docs/FRONTEND_DESIGN.md` 应从已成型界面中提炼应长期保持的设计规则。

### 2. 按职责分层信息

所有信息必须先分层，再写入文档：

```text
AGENTS.md               = coding agent 应该如何工作
docs/CURRENT_STATE.md   = 当前仍然有效的项目事实
docs/FRONTEND_DESIGN.md = 稳定的前端设计与交互约束
docs/plans/             = 重要方案、架构取舍和演进记录
```

不要把全局开发规则写进 `CURRENT_STATE.md`。不要把历史方案当作当前真相。不要把当前实现细节写成稳定设计规范。

### 3. 主动降噪

生成文档时，主动排除：

- 冗长历史过程。
- 大量会议纪要原文。
- 不稳定的临时 workaround。
- 两周内大概率会变化的试验性约定。
- 纯讨论性分析。
- 与当前任务无关的背景介绍。
- 面向展示的宣传文案。

### 4. 生成文件

优先复用 `references/templates/` 中的模板骨架，再根据项目材料填入事实。

必须遵守：

- 不确定的信息使用 `<pending>` 或更具体的占位符。
- 能从代码、README 或用户材料中确认的信息，才写成确定事实。
- `CURRENT_STATE.md` 默认控制在 100-250 行。
- `AGENTS.md` 不塞入高频变化的接口字段和局部实现细节。
- `FRONTEND_DESIGN.md` 只写稳定设计约束，不写临时 bug 或偶然实现方式。

### 5. 最终检查

输出前阅读 `references/quality-checklist.md`，确认：

- 分层是否清楚。
- 是否没有把历史写成当前事实。
- 是否没有发明未知信息。
- 默认阅读路径是否足够短。
- 生成内容是否可以直接落盘。

## 参考文件

- `references/doc-layering-principles.md`：文档分层原则。
- `references/project-info-extraction.md`：项目信息提取清单。
- `references/output-contract.md`：输出契约。
- `references/quality-checklist.md`：质量检查清单。
- `references/templates/`：各类目标文件模板。
- `references/source-original-skill.md`：原始 skill 文档，仅作溯源，不作为默认首读文件。
