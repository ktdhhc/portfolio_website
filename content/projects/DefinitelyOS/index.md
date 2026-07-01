---
name: DefinitelyOS
tagline: 一个伪装成古早操作系统的 LLM 幻觉电脑
type: personal
role: 独立开发
period: "2026.06"
tags:
  - React
  - TypeScript
  - LLM
  - DeepSeek
  - 创意项目
featured: true
---

## 这是什么

DefinitelyOS 是一个操作系统。真的。

它有桌面、任务栏、窗口系统、文件浏览器、终端、浏览器、搜索、文本编辑器。你可以打开窗口、输入命令、搜索文件、访问网页。它看起来像 Windows 98，用起来也像 Windows 98，甚至响应速度也像 Windows 98——因为 LLM 的延迟刚好符合老系统的卡顿感。

唯一的区别是：你看到的一切都是 AI 实时生成的。文件不存在，网页不存在，终端输出不存在。它们都是 LLM 的幻觉，但系统不会告诉你这一点。它只以操作系统的方式回应你。

---

## 它是怎么骗人的

有一次我拿 DefinitelyOS 向朋友展示，没有告诉他这是 LLM 驱动的。他打开终端，输入命令，得到回复；打开浏览器，输入 URL，看到网页；打开文件夹，浏览文件。一切看起来都很正常。

五分钟后他打开了一个 JPG 文件。

那是 LLM 画的线框图。

---

## 它能做什么

DefinitelyOS 有八个应用，其中七个接通了 LLM：

| 应用 | 做什么 |
|---|---|
| Terminal | 输入命令，LLM 生成符合终端人设的输出。有些命令有彩蛋。 |
| Browser | 输入 URL，LLM 实时生成一个网页，链接可以点击导航。 |
| Files | 打开文件夹，LLM 生成目录内容；打开文件，LLM 生成文件内容。 |
| Run | 输入一句话，LLM 生成一个一次性小程序（Scriptlet）。 |
| Notepad | 打开时内容已生成，支持手动编辑，Ctrl+Enter 让 LLM 续写。 |
| Document Reader | 同上，但支持 Markdown 渲染。 |
| Image Viewer | LLM 根据文件名生成 ASCII art + emoji。 |
| Search | 本地假数据，唯一没接通 LLM 的应用。 |

其中最有意思的是 **Scriptlet 系统**。用户在 Run 里输入一句自然语言描述——比如"做一个帮我计算咖啡因摄入量的工具"——LLM 会生成一个 JSON 格式的迷你程序，前端根据类型分发渲染。Scriptlet 有三种形态：

- **Terminal**：一个有自己人设的命令行，静态规则优先匹配，未命中的命令走 LLM fallback。help 命令故意漏掉一些隐藏命令。
- **Dashboard**：数据展示面板，生成时一次性产出全部数据，支持重新生成。
- **Form**：输入字段 + LLM 输出，每次提交触发一次 LLM 调用。

Scriptlet 是一次性的，关窗即丢。系统不解释它是什么，它只是一个窗口。

---

## 为什么做这个

起因是在 B 站上看到一个 VibeOS 的演示视频，主张"一切都由 AI 幻觉驱动"。没有技术细节，没有公开项目，只有一个概念：让 AI 假装成操作系统。

我觉得很好玩，就按自己的理解把它做了出来。复古界面参考 Windows 98，LLM 用 DeepSeek V4 Flash，前端用 React + TypeScript，Server 用 Hono。大概两周完成主要开发，心态很轻松，跟着感觉走，反反复复修不好就妥协走 B 方案，突然有更好的点子就临时着手干。

出来的成品比想象中更像一个操作系统。这不是一个严肃的工程项目，它就是好玩。

---

## 技术基础

| 层次 | 技术 |
|---|---|
| 前端 | Vite + React 19 + TypeScript + Zustand + Tailwind CSS |
| Server | Hono（8 个 API 路由，含 2 个 SSE 流式端点） |
| LLM | DeepSeek V4 Flash（通过 server 代理，可切换） |
| 校验 | Zod（所有 LLM 返回值校验后才渲染） |
| 持久化 | localStorage |

一个关键设计原则：所有 LLM 调用走 server 代理，前端从不直接调 LLM。所有 LLM 返回值经过 Zod 校验，校验失败有降级处理，不会崩溃。错误信息符合当前应用的人设，不会暴露原始错误。

---

## 最后

DefinitelyOS 不是一个试图解决什么问题的项目。它是一个关于"AI 能假装成什么"的实验。如果你对 LLM 应用的交互方式感兴趣，或者只是想找点乐子，可以试试看。真的。
