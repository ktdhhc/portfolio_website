# ADR-0005: 代码仓库保持私有

## 状态

accepted

## 上下文

项目通过 Cloudflare Pages 自动部署，仓库托管在 GitHub。需要决定仓库可见性。

候选方案：

- **公开仓库**：免费、便于展示协作能力，访客可浏览仓库内容。
- **私有仓库**：仓库内容不对外可见，Cloudflare Pages 仍可自动部署。

## 决策

采用**私有仓库**。

## 理由

1. **ADR-0003 的前提**：ADR-0003 决定 Agent 参考资料（`content/projects/{slug}/refs/*.md`）不生成公开路由、只供 Agent 检索，实现分层信息披露。若仓库公开，访客可直接在 GitHub 浏览 refs 原文，绕过 Agent 间接获取的设计，使 ADR-0003 形同虚设。
2. **隐私保护**：仓库含个人简历、联系方式、Agent system prompt 与 answer-rules，公开会暴露不必要的个人信息和 Agent 内部逻辑。
3. **不影响部署**：Cloudflare Pages 对 GitHub 私有仓库的自动部署支持成熟，零额外成本。

## 代价

无法通过公开仓库展示协作能力。如未来希望开源，需将 refs/、个人信息、Agent 内部逻辑剥离到独立私有仓库，或重构内容组织方式，使公开部分不含敏感内容。
