---
summary: Keyper 开发过程中的技术选型思考、探测引擎设计、产品边界把控和开发节奏体会
---

# Keyper 开发笔记

## 技术选型

### 为什么是 Tauri + Rust

核心需求是"长时间后台静默运行 + 快速呼出 + 极低资源占用"。在这三个约束下，Tauri 是比 Electron 更合适的选择：二进制体积小、内存占用低、启动快。Rust 后端负责 SQLite 读写和 HTTP 请求，性能足够，不需要额外的运行时。

前端选择 React + TypeScript + Tailwind + shadcn/ui 是因为这套组合开发效率高，组件库现成，不需要花时间在基础 UI 上。Zustand 做状态管理，轻量且够用。

### 没有选择的技术路线

一开始考虑过做"轻量版 OpenRouter"——一个模型能力对比页面，展示不同模型在各项指标上的表现。仔细斟酌后砍掉了，原因是这不是高频需求，且维护成本高。产品应该先把使用频率最高的功能做好：存储、查找、探测。

## 探测引擎设计

### 四个维度的确定

stream、vision、audio、reasoning 四个维度基本覆盖了主流模型的核心能力。选择这四个而不是更多，是因为它们各自对应一个独立的 API 调用路径，测试逻辑清晰，结果可量化。更多的维度（如 function calling、embedding）在 MVP 阶段不是必须的。

### 异步并发

探测引擎全部 async 实现，使用非阻塞 reqwest。并发数可配置（默认 10），通过设置页调整。批量探测时，每个 Key 的结果独立回写，不需要等待全部完成。前端 `runOneKey` 批量更新状态，每 Key 2 次渲染而非 6 次，减少 UI 抖动。

### OpenRouter SSE 兼容

部分供应商（如 OpenRouter）使用 SSE 格式返回数据，和标准 JSON 不同。引擎在 JSON 解析失败时自动 fallback 解析 SSE，reasoning 模块同理。`completion_tokens` 为 0 时不判 slow，避免误报。

### 认证路由

不同平台的认证方式不同：

- `xiaomi` → `api-key` header
- `anthropic` → `x-api-key` header
- 其他 → `Authorization: Bearer` header

这个路由逻辑按 `provider_type` 字段分发，在预设模板中已经配置好。自定义 Platform 时用户也可以手动选择认证方式。

## 产品边界

### 砍掉的功能

- **能力对比页**：非高频需求，维护成本高
- **Playground**：已有大量更好的工具，Keyper 不做对话
- **团队协作 / 云端同步**：定位是个人工具，不做多用户

### 保留的功能

- Platform / Key CRUD：核心
- 批量探测 + 结果持久化：核心
- 预设模板：降低使用门槛
- Ctrl+K 搜索：提升效率
- 导出代码：高频使用场景

### "探测-导出代码"的发现

开发过程中发现，探测成功后导出可用的调用代码是一个高频需求。各家 API 的调用方式有细微差异——认证头部格式、思考模式参数名（`reasoning` vs `effort`）、temperature 取值范围——这些细节在反复测试中被固化到预设模板里，使得导出的代码可以直接使用。这个功能不是一开始规划的，而是在使用过程中自然涌现的。

## 各家 API 差异记录

开发过程中积累了一些各家 API 的"方言差异"：

- **认证头部**：OpenAI 用 `Authorization: Bearer`，Anthropic 用 `x-api-key`，小米用 `api-key`
- **思考模式参数**：有的模型用 `reasoning` 标签，有的用 `effort`，且强度梯度不完全匹配
- **temperature 取值**：Kimi 比较新的模型只能设为 1，其他值会报错
- **SSE 格式**：OpenRouter 使用 SSE 而非标准 JSON，需要 fallback 解析

这些差异没有统一文档可以参考，只能在反复测试中逐步积累。预设模板的可用性正是建立在这些实际测试经验之上。

## 开发节奏

整个项目大约一周收尾（2026年5月）。此时已经积累了 Aindexer 和 MemCraft 的开发经验，对开发节奏有比较清晰的把控：

- 前期文档清晰，产品设计文档和工程实现文档都提前写好
- 功能边界明确，不膨胀，不做"顺手加"的功能
- 技术难点不多，主要时间花在交互细节和预设模板的测试上

### 毛玻璃效果的妥协

最初想做毛玻璃特效，反复尝试后发现 Tauri 的窗口透明机制和 CSS backdrop-blur 的配合有兼容性问题。最终妥协为透明背景 + GlassPanel 的 `backdrop-blur-xl`，视觉效果接近但不完全等同于原生毛玻璃。这是一个务实的取舍——花太多时间在视觉效果上不值得，核心功能更重要。

## 开发经验对比

和第一次做 Aindexer 时相比，Keyper 的开发过程明显更流畅：

- **前期规划**：Aindexer 时期是"抽奖式编程"，Keyper 时期已经能在一开始就定下清晰的功能边界和技术路线
- **产品边界**：Aindexer 时期会"顺手加功能"，Keyper 时期能克制住膨胀的冲动
- **技术决策**：Aindexer 时期在 API Key 和 UI 优化上浪费了大量时间，Keyper 时期能把精力集中在核心链路上
- **文档习惯**：Aindexer 的文档体系是逐步试错沉淀下来的，Keyper 直接继承了 AGENTS.md / CURRENT_STATE.md / FRONTEND_DESIGN.md 的文档结构

这个项目更像是对已有能力的一次检验，而不是一次全新的探索。
