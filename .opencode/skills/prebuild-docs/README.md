# prebuild-docs skill 包

这个 skill 用于为软件项目生成或重构一套分层上下文文档体系，帮助后续 coding agent 用更少上下文快速接手项目。

## 这个 skill 会生成什么

在目标项目中，本 skill 会生成或重构：

```text
AGENTS.md
docs/
  CURRENT_STATE.md
  FRONTEND_DESIGN.md
  plans/
    README.md
    <可选方案文件>.md
```

## 核心作用

这个 skill 用来避免后续 agent 混淆以下内容：

- 全局 agent 工作规则 vs 项目当前事实
- 当前仍然有效的事实 vs 历史方案
- 稳定设计约束 vs 当前实现细节
- 必读上下文 vs 按需参考材料

## 包结构

```text
prebuild-docs/
  SKILL.md
  README.md
  references/
    doc-layering-principles.md
    project-info-extraction.md
    output-contract.md
    quality-checklist.md
    source-original-skill.md
    templates/
      AGENTS.md
      CURRENT_STATE.md
      FRONTEND_DESIGN.md
      plans-README.md
      plan-template.md
  scripts/
    validate_doc_set.py
  tests/
    eval_prompts.md
```

## 使用方式

把整个 `prebuild-docs/` 文件夹放入你的 agent skills 目录。之后，当用户要求为项目搭建 agent 接手文档、低噪音项目文档体系，或生成 `AGENTS.md` / `CURRENT_STATE.md` / `FRONTEND_DESIGN.md` / `docs/plans/` 时，agent 应优先调用本 skill。

## 基础校验

为目标项目生成文档后，可以运行：

```bash
python scripts/validate_doc_set.py /path/to/repo
```

该脚本会检查目标项目中是否存在必要文件，并提醒 `docs/CURRENT_STATE.md` 是否明显过长。
