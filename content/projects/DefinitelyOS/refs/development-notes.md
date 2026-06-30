---
summary: DefinitelyOS 开发过程中的设计决策、Scriptlet 系统迭代、LLM 应用边界和开发心态
---

# DefinitelyOS 开发笔记

## 灵感与还原

项目起源于 B 站上看到的 VibeOS 演示视频。VibeOS 主张"一切都由 AI 幻觉驱动"，但只有演示，没有技术细节，也没有公开项目。DefinitelyOS 是按自己的理解对这个概念的还原和扩展。

还原的部分：复古界面、所有内容实时生成、应用脚本实时编写和渲染。
扩展的部分：Document Reader（打开时内容生成 + 手动编辑 + 幻觉续写）、文件触发执行（.exe/.bat/.app 双击直接生成 Scriptlet）。

## Scriptlet 系统设计

### 从构想到落实

Scriptlet 系统不是一开始就设计好的，而是从一个模糊的"最终效果"逐步迭代出来的。

最初的构想：用户输入一句话，系统生成一个可交互的迷你程序。但"迷你程序"具体长什么样、怎么渲染、LLM 返回什么格式，都没有明确答案。

迭代过程：
1. 先确定主要有几种类型：终端、静态图表、实时运行的脚本
2. 让 LLM 判断用户意图去选择类型
3. 针对每个类型独立优化：需要什么样的 schema、如何验证、如何渲染
4. 最终确定三种类型：terminal（规则 + LLM fallback）、dashboard（一次性数据）、form（输入 + LLM 输出）

每个类型的 schema 和渲染逻辑都是在开发过程中逐渐细化的。一开始只有一个最终效果，中间经历了多次 schema 调整和渲染逻辑重写。

### Zod 校验的角色

LLM 返回的 JSON 不一定符合预期格式。Zod 在其中扮演了"信任边界"的角色：
- 所有 LLM 返回值必须经过 Zod 校验才进入渲染
- 校验失败有降级处理，不会崩溃
- schema 定义在 `src/scriptlet/schema.ts`，使用 discriminatedUnion 按 type 分发

实际运行中，LLM 返回的 JSON 大部分时候格式正确，但在复杂结构（如嵌套的 dashboard sections）上偶尔会出错。Zod 校验把这些问题挡在了渲染层之外。

### Terminal 的规则优先设计

Terminal 类型有一个有趣的设计：静态规则优先匹配，未命中的命令才走 LLM fallback。

这意味着 LLM 在生成 Scriptlet 时会同时产出一组 rules（静态命令映射）和一个 fallback 配置。渲染器先检查命令是否命中 rules，命中则直接返回预设输出，不调 LLM。这既降低了延迟，也让某些命令的行为可以被"固化"。

一个细节：help、clear、cd 这些命令，渲染器提供了能力，但 LLM 通过 rules 决定是否执行。一个"固执的终端"可以拒绝清屏并回以讽刺。规则优先于内置行为。

## LLM 应用的边界

### 延迟即特性

LLM 的响应需要时间，这在大多数应用里是缺点，但在 DefinitelyOS 里反而成了优势——老系统本来就卡。Windows 98 的视觉风格和 LLM 的延迟天然匹配，如果设计成现代 UI 反而容易穿帮。

这个观察对 LLM 应用设计有启发：有时候不是要消除 LLM 的局限性，而是找到一个局限性恰好成为特性的场景。

### 幻觉即内容

在 DefinitelyOS 里，LLM 的幻觉不是 bug，而是 feature。文件不存在没关系，网页不存在没关系，它们本来就不需要"存在"——只需要"看起来存在"。这是一个把 LLM 的弱点转化为卖点的设计。

### 错误的人设化处理

LLM 调用失败时，错误信息不会以原始形式暴露给用户。而是根据当前应用的人设生成主题化错误。比如一个"遗憾编译器"终端出错时，会显示"Regret compilation buffer overflow"而不是"Internal Server Error"。

## 开发心态

这个项目和其他项目的最大区别是心态。没有"必须做出什么功能"的压力，没有明确的 deadline，功能跟着感觉走。反反复复修不好就妥协走 B 方案，突然有更好的点子就临时着手干。

这种心态反而让开发过程更流畅。没有过度设计，没有完美主义，做出来的东西能用就行。最后的成品比预期更好，可能正是因为没有给自己设限。

## 技术细节

### 前端架构

- shell/：Desktop、Taskbar、WindowFrame、WindowManager
- apps/：各应用组件，每个应用独立目录
- kernel/：Zustand store，管理窗口状态和虚拟文件系统
- scriptlet/：schema 定义 + 三种渲染器
- llm/：LLMClient 接口 + DeepSeek 实现 + 前端 API 封装

### Server 架构

- Hono 框架，8 个 API 路由
- 所有 prompt 在 `server/prompts/` 中管理（中文）
- 2 个 SSE 流式端点（Browser、Notepad）
- LLMClient 接口可切换，当前用 DeepSeek

### 虚拟文件系统

- 根目录硬编码（Desktop、Documents、Downloads、System、Programs、Logs、Temp）
- 子目录内容由 LLM 实时生成，按路径缓存
- 文件内容缓存在 api.ts 模块级，重命名/删除时清除
- 双击文件根据扩展名映射到不同应用

### 测试

195 个测试全绿，覆盖 store + API + 组件 + 集成 + 流式 + 文件操作 + Scriptlet 渲染器。测试框架：Vitest + React Testing Library + happy-dom。
