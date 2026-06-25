# Issue 009: E2E 测试补全 + Lighthouse 性能审计

**阶段**: 阶段 1
**类型**: AFK
**状态**: ready-for-agent

## Parent

`docs/prd/stage-1-static-pages.md`

## What to build

阶段 1 收尾 slice：在全部 5 个公开页面就绪后，补全 E2E 测试覆盖、移动端测试和 Lighthouse 性能审计，确保阶段 1 验收标准达成。

**E2E 可访问性测试**：覆盖全部 5 个公开页面返回 200：
- `/` 首页（阶段 0 已有测试，保留）
- `/resume` 简历页
- `/projects` 项目列表页
- `/projects/aindexer`（代表性详情页）
- `/projects/nonexistent` 返回 404

**E2E 内容驱动验证**：
- `/resume` 页面的教育内容来自 `content/resume.json`（验证学校名出现）
- `/projects` 页面展示全部项目（验证 4 个项目名称都出现）
- `/projects/[slug]` 详情页正文来自 index.md（验证九段式标题出现）

**E2E 导航验证**：
- 首页导航"简历"链接指向 `/resume`
- 首页导航"项目"链接指向 `/projects`
- /projects 页面项目卡片"查看详情"链接指向 `/projects/[slug]`
- 项目详情页有返回 /projects 的链接
- 首页锚点导航（关于/教育/经历）仍能滚动到对应 section

**E2E 移动端测试**：
- 移动端视口（375px）下 /resume、/projects、/projects/[slug] 页面可浏览
- 移动端导航链接隐藏
- 项目卡片纵向堆叠

**Lighthouse 性能审计**：
- 对 5 个公开页面跑 Lighthouse，性能分 ≥ 90
- 使用 Playwright Chromium 的 Lighthouse 集成或手动跑
- 关注 Performance、Accessibility、Best Practices、SEO 四项

**构建完整性**：
- `npm run build` 成功，dist/ 包含 5 个公开页面 + 4 个项目详情页

注：阶段 1 的各 slice 已各自带了部分 E2E 测试，此 slice 的职责是补全到全覆盖 + 跑 Lighthouse。避免重复测试，只补缺口。

## Acceptance criteria

- [ ] E2E 测试覆盖全部 5 个公开页面返回 200
- [ ] E2E 测试覆盖 /projects/nonexistent 返回 404
- [ ] E2E 内容驱动验证：/resume 内容来自 resume.json
- [ ] E2E 内容驱动验证：/projects 展示全部项目
- [ ] E2E 内容驱动验证：详情页正文来自 index.md
- [ ] E2E 导航验证：页面间链接正确
- [ ] E2E 导航验证：首页锚点仍可滚动
- [ ] E2E 移动端：375px 视口下新页面可浏览
- [ ] E2E 移动端：导航链接隐藏 + 卡片纵向堆叠
- [ ] Lighthouse 性能审计 ≥ 90（5 个公开页面）
- [ ] `npm run build` 成功，dist/ 包含 9 个页面（5 公开 + 4 详情）
- [ ] `npm test` 全部通过
- [ ] `npm run test:schema` 全部通过（回归不破坏阶段 0 schema 测试）

## Blocked by

- Issue 006（Nav + /projects 页面）
- Issue 007（/projects/[slug] 详情页）
- Issue 008（/resume 页面 + PDF 下载）
