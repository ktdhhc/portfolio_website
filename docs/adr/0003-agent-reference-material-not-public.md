# ADR-0003: 项目补充资料只供 Agent 检索，不生成公开路由

## 状态

accepted

## 上下文

每个项目在 `content/projects/{slug}/` 下有两类内容：

- `index.md` —— 项目详情页正文（Project Page Content），九段式叙述，面向所有访客公开。
- `refs/*.md` —— Agent 参考资料（Agent Reference Material），比公开简历更细的补充资料，含简历中没有的内部细节。

候选方案：

- **完全公开**：`refs/` 也生成静态页面或进文件树，访客可直接访问原文。
- **只供 Agent 检索**：`refs/` 在构建时注入 Agent 知识库，不生成公开路由，访客只能通过 Agent 问答间接获取信息。
- **混合**：部分 `refs/` 公开、部分只供 Agent，按文件标注区分。

## 决策

采用**只供 Agent 检索**：`refs/*.md` 不进入 Astro Content Collections 的公开路由，构建时被读取并注入 Agent 的 system prompt / 上下文，访客无法直接访问原文，只能通过 Agent 问答间接获取。

## 理由

1. **分层信息披露**：详情页给所有人看脱敏版，深入问题通过 Agent 按需释放，既不让面试官问不到细节，也不把可能敏感的内部内容全摊开。
2. **Agent 的价值正是可控释放**：Agent 遵循 answer-rules（不编造、不夸大、对敏感信息有判断），是比"直接公开 Markdown"更安全的披露路径。
3. **符合产品大纲边界**：大纲强调"可信、不夸大"，分层披露比全公开更克制。

## 代价

访客无法直接浏览项目全部细节，必须通过 Agent 交互才能获取深层信息。这恰好是产品想要的——Agent 是辅助入口，不是可有可无的装饰。

## 实现约束

- `refs/` 不注册为 Astro Content Collection（不生成路由）。
- 构建时通过自定义脚本读取 `refs/*.md`，拼装进 Agent system prompt 或上下文。
- 第一版资料量小，直接塞 system prompt，不做 RAG / 向量检索。
