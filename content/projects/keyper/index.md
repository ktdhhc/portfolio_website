---
name: Keyper
tagline: 轻量级 LLM API Key 管理与探测桌面工具
type: personal
role: 独立开发
period: "2026.05"
tags:
  - Tauri
  - Rust
  - React
  - SQLite
  - API Key 管理
  - 桌面应用
featured: true
---

## 项目是什么

Keyper 是一个轻量级的桌面工具，用来统一管理各个平台的 LLM API Key，同时支持快速探测 Key 的有效性和模型能力。它解决的是一个很日常的问题：做 AI 开发的人手里通常有很多平台的 Key——OpenAI、Anthropic、Google、小米、各种中转站——这些 Key 散落在记事本、环境变量、项目配置文件和临时对话里，时间一长就找不到、记不清、也不知道哪个还能用。

Keyper 把这些 Key 收拢到一个地方，给它们挂上平台标签，支持一键复制和批量探测。它不是一个 Playground，也不做对话功能，只专注于 Key 本身的管理和验证。

<img src="/images/Keyper/ScreenShot_2026-06-30_231104_288.png" alt="Keyper" style="max-width: 100%; border-radius: 12px;" />

---

## 它在解决什么

这个问题看起来小，但在实际开发中出现频率很高。你可能换了台电脑，发现某个 Key 不在环境变量里；你可能两个月没用某个平台的 API，不确定 Key 还有没有效；你可能同时维护好几个中转站的 Key，需要快速确认哪个能用、哪个的模型支持 vision 或 reasoning。

传统做法是翻记事本、跑一段测试代码、或者打开平台后台看一眼。这些方式都能用，但都慢，而且没有历史记录。Keyper 想把这个流程压缩到几秒钟内完成：找到 Key、复制、或者一键探测，结果自动回写。

---

## 它是怎么工作的

Keyper 的核心数据结构很简单：

```text
Platform（一级实体）
├── Key（最小操作单位，必须归属 Platform）
│   └── TestRecord（测试历史）
└── Model（可选资源）
```

Platform 是平台，比如 OpenAI、Anthropic、某个中转站。Key 是具体的 API Key，必须挂在某个 Platform 下面。TestRecord 是每次探测的结果，包含延迟、速度、错误码等信息。Model 是平台支持的模型列表，可选。

探测系统是这个项目最有技术含量的部分，覆盖四个维度：

| 维度 | 测试内容 |
|---|---|
| stream | 流式文本生成，测量首 token 延迟和输出速度 |
| vision | 图片理解能力，发送测试图片验证多模态支持 |
| audio | 音频理解能力，验证语音模型的可用性 |
| reasoning | 推理能力，通过复杂问题测试思考链输出 |

四个维度可以单独或批量执行。探测完成后，结果会自动写入 TestRecord，同时更新 Key 的状态标签（正常、慢、错误）。Dashboard 上用环形图和卡片展示整体健康度，"需关注"列表会把有问题的 Key 高亮出来。

除了手动探测，Keyper 还预置了 12 个主流供应商的调用模板。用户新建 Platform 时选择模板，系统会自动填充 base URL、认证方式和默认模型，不需要自己去翻文档查 endpoint。这个预设机制也间接解决了一个实际问题：各家 API 的调用方式有细微差异——认证头部的格式、思考模式的参数名、temperature 的取值范围——这些细节在反复测试中被逐步固化到预设里，使得导出的调用代码可以直接使用。

---

## 主要部分

整个应用由四个页面组成：

| 页面 | 作用 |
|---|---|
| Dashboard | 全局概览，环形图展示 Key 健康度，卡片统计总数和最近活动 |
| Platforms | 平台和 Key 的树形管理，支持 CRUD、复制、标签、搜索 |
| Probe | 批量探测入口，按平台筛选，结果逐格点亮展示 |
| Settings | 主题、Prompt 模板、并发数、数据路径配置 |

快捷键 Ctrl+K 可以全局搜索，输入平台名或 Key 名就能快速定位，点击结果自动跳转到对应位置。这个设计服务于核心使用路径：找到平台 → 找到 Key → 复制或测试 → 确认状态。

---

## 技术基础

| 层次 | 技术 |
|---|---|
| 后端 | Tauri 2、Rust、SQLite（rusqlite） |
| 前端 | React 18、TypeScript、Vite 5、Tailwind CSS、shadcn/ui、Zustand |
| 探测引擎 | async reqwest，非阻塞 HTTP，支持 SSE 流式解析 |
| 窗口 | 透明背景 + 自定义标题栏，可拖拽 |

选择 Tauri + Rust 是因为这个工具需要长时间在后台静默运行，同时要快速呼出和响应。Tauri 的二进制体积和内存占用都远低于 Electron，更适合作为一个"常驻但不打扰"的桌面小工具。

探测引擎全部采用异步实现，支持并发控制（默认 10，可在设置页调整）。对于 OpenRouter 等使用 SSE 格式的供应商，引擎会自动 fallback 解析，不需要用户手动区分。认证头部按 `provider_type` 路由，不同平台走不同的认证格式。

---

## 最后

Keyper 是一个目标很明确的工具：把 LLM API Key 的管理从"翻记事本"变成"快捷键呼出、一键操作"。它不试图做一个全能的 AI 开发平台，只专注于 Key 本身的存储、查找和验证这一个环节。如果日常工作中频繁需要管理多个平台的 API Key，这个工具会让这个过程轻很多。
