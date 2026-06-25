# 005 · 阶段 0 验收 + CURRENT_STATE 更新

**状态**: ready-for-agent
**Type**: HITL
**Parent PRD**: docs/prd/stage-0-scaffold-and-content-model.md

## What to build

阶段 0 全部 issue 完成后的人工验收。需要人工审阅：内容质量（项目九段式是否真实准确、Agent system-prompt 与 answer-rules 是否完整、简历数据是否与 demo 一致）、设计还原度（首页是否对齐 FRONTEND_DESIGN.md 暖白主题、组件是否拆分合理、响应式是否可用）、schema 校验是否生效。

验收通过后更新 `docs/CURRENT_STATE.md`：把"当前阶段"从"阶段 0 准备期"改为"阶段 1 进行中"，补充 Astro 工程结构与默认命令（npm run dev / npm run build），更新 UI 结构为已实现的首页 section 列表，更新关键文件地图为已建立的真实目录。

## Acceptance criteria

- [ ] 人工审阅 4 个项目的九段式内容：真实、准确、无编造、无 NDA 违规
- [ ] 人工审阅 Agent system-prompt 与 answer-rules：覆盖产品大纲 5.1/5.2 节全部要点 + 跟随用户语言规则
- [ ] 人工审阅 resume.json 与 profile.json：数据与 demo/index.html 一致或更新
- [ ] 人工审阅首页设计还原度：配色对齐 FRONTEND_DESIGN.md 暖白主题，布局参考 demo，组件已拆分
- [ ] 人工验证移动端响应式：640px 断点下 Hero 标题缩小、卡片纵向堆叠、导航简化
- [ ] 人工验证 schema 校验生效：故意删一个必填 frontmatter 字段，`astro build` 报错
- [ ] 人工验证内容驱动：改一个 content 文件刷新页面，内容变化
- [ ] `docs/CURRENT_STATE.md` 更新："当前阶段"改为"阶段 1 进行中"
- [ ] `docs/CURRENT_STATE.md` 更新：补充 Astro 工程结构（src/pages、src/components、src/layouts、src/styles、content/ 结构）
- [ ] `docs/CURRENT_STATE.md` 更新：补充默认命令（npm run dev / npm run build）
- [ ] `docs/CURRENT_STATE.md` 更新：UI 结构改为已实现的首页 section 列表
- [ ] `docs/CURRENT_STATE.md` 更新：关键文件地图补齐已建立的真实目录
- [ ] `docs/CURRENT_STATE.md` 更新：移除"Astro 工程尚未初始化"等已失效事实

## Blocked by

- #002（项目内容完整）
- #003（简历数据与首页全 section）
- #004（Agent 文档）
