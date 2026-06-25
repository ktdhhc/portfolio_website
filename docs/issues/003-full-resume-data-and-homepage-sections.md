# 003 · 完整简历数据 + 首页全 section 渲染

**状态**: ready-for-agent
**Type**: AFK
**Parent PRD**: docs/prd/stage-0-scaffold-and-content-model.md

## What to build

把完整简历数据抽到 `content/resume.json`（教育经历、实习经历含子项目 bullet points、技能栈按四类分组、HEART-Bench 论文放经历里），扩展 `content/profile.json` 补齐首页所需全部字段，然后用 Astro 页面渲染首页的全部 section（关于/教育/技能/实习经历/代表项目/Agent CTA），数据全部来自 content/ 文件。

首页布局参考 demo/index.html 的结构（居中 Hero、单栏卡片、8rem section 间距），配色遵循 FRONTEND_DESIGN.md 暖白主题。组件按 FRONTEND_DESIGN.md 第 9 节最小集合拆分：Nav、SectionHeader、Badge、Button、Card、Tag、Link、Divider。

## Acceptance criteria

- [ ] `content/resume.json` 含完整教育经历（华南师范大学硕士 + 华南农业大学本科，含学校/学位/专业/时间段/研究方向或主修课程）
- [ ] `content/resume.json` 含完整实习经历（趣丸科技，含公司/职位/时间段/3 个子项目 bullet points）
- [ ] `content/resume.json` 含 HEART-Bench 论文条目（放经历里，不单独建项目）
- [ ] `content/resume.json` 含技能栈按四类分组（Agent 架构设计 / 数据与研究 / 产品与工程 / 实验与心理学工具），每类含具体技能
- [ ] `content/profile.json` 补齐首页全部所需字段（姓名、定位、一句话描述、学历、院校、毕业时间、研究方向、所在地、邮箱、GitHub、产品主页）
- [ ] 首页渲染全部 section：导航 + Hero + 关于 + 教育背景 + 技能工具 + 实习经历 + 代表项目 + Agent CTA + Footer
- [ ] 关于 section 含核心能力描述 + 关键元信息（学历/院校/毕业时间）
- [ ] 技能 section 用标签云展示，3 个核心技能高亮（highlight 态）
- [ ] 实习经历用单张卡片展示，含公司 + 职位 + 时间 + 3 段子项目 bullet points
- [ ] 代表项目 section 展示全部 4 个项目卡片（Aindexer + 角色记忆平台 + 2 个实习项目），每张卡片含名称/时间/描述/技术标签/外链
- [ ] Agent CTA section 用暖色背景区块（accent-bg），引导访客与 Agent 对话
- [ ] 所有 section 数据来自 `content/` 文件，页面无硬编码个人资料
- [ ] 修改 `content/resume.json` 的技能或经历后刷新首页，对应 section 变化
- [ ] 配色、间距、圆角遵循 FRONTEND_DESIGN.md（暖白主题、8rem section 间距、16px 卡片圆角）
- [ ] 组件拆分为独立 .astro 文件（Nav、SectionHeader、Badge、Button、Card、Tag、Link、Divider），不在单文件里堆叠
- [ ] 移动端响应式（640px 断点，Hero 标题缩小、卡片纵向堆叠、导航简化）
- [ ] `astro dev` 本地能跑起来无报错

## Blocked by

- #002（首页"代表项目" section 需要全部 4 个项目内容才完整）
