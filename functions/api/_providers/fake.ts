import type { Provider, ChatRequest, ChatResponse } from './types';

// Fake provider — 用于 E2E 测试和本地开发（ACTIVE_PROVIDER=test）
// 不调真实 API，不花钱，返回固定响应。
export const fakeProvider: Provider = {
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const userMessages = request.messages.filter((m) => m.role === 'user');
    const lastUser = userMessages[userMessages.length - 1];
    const text = lastUser?.content ?? '';

    if (text.includes('无限工具')) {
      return {
        content: '',
        tool_calls: [
          {
            id: 'fake-loop-read',
            function: {
              name: 'read_file',
              arguments: JSON.stringify({ file: 'resume.json' }),
            },
          },
        ],
      };
    }

    if (text.includes('非法文件')) {
      return {
        content: '',
        tool_calls: [
          {
            id: 'fake-illegal-read',
            function: {
              name: 'read_file',
              arguments: JSON.stringify({ file: '../package.json' }),
            },
          },
        ],
      };
    }

  if (text.includes('provider 超时')) {
    throw new Error('Provider timeout');
  }

  if (text.includes('真实思维链')) {
    return {
      thinkingContent: '我先确认问题范围，再基于当前资料决定是否需要继续读取文件。',
      content: '这是基于真实思维链示例返回的最终回答。',
    };
  }

  if (text.includes('薪资') || text.includes('私人住址')) {
    return {
      content: '不能替候选人承诺薪资、到岗时间或其他现实事项，也不披露私人敏感信息。建议直接联系候选人确认这些问题。',
      };
    }

    if (text.includes('私人旅行') || text.includes('最喜欢')) {
      return {
        content: '现有资料中无法确认这个问题。Candidate Agent 只能基于简历、项目文档和公开作品资料回答。',
      };
    }

    const toolMessages = request.messages.filter((m) => m.role === 'tool');
    const lastTool = toolMessages[toolMessages.length - 1];
    if (text.includes('思考模式工具调用') && lastTool) {
      const assistantToolCall = [...request.messages]
        .reverse()
        .find((message) => message.role === 'assistant' && message.tool_calls?.length);
      if (!assistantToolCall?.reasoning_content) {
        throw new Error('reasoning_content is required when replaying a tool call');
      }
    }
    if (text.includes('完整输出') && lastTool?.name === 'read_file') {
      return { content: lastTool.content };
    }
    if (lastTool?.name === 'read_file' && lastTool.content.includes('# Aindexer 开发笔记')) {
      return {
        content: 'Aindexer 的开发过程经历了多轮版本迭代，并逐步沉淀出本地化架构、资料分层读取和桌面端落地经验。',
      };
    }
    if (lastTool?.name === 'read_file' && lastTool.content.includes('Aindexer')) {
      return {
        content:
          'Aindexer 是面向科研文献的本地化 AI 工作台，覆盖文献上传、结构化索引、搜索预览、人工修订、翻译辅助与导出备份流程。技术上使用 FastAPI + SQLite + React + RAG 检索 + 本地文件存储。',
      };
    }

    if (text.includes('Aindexer 开发笔记')) {
      return {
        content: '',
        tool_calls: [
          {
            id: 'fake-read-aindexer-development-notes',
            function: {
              name: 'read_file',
              arguments: JSON.stringify({ file: 'projects/aindexer/refs/development-notes.md' }),
            },
          },
        ],
      };
    }

    if (text.includes('Aindexer')) {
      return {
        content: '',
        thinkingContent: text.includes('思考模式工具调用') ? '先读取 Aindexer 项目资料，再基于工具结果回答。' : undefined,
        tool_calls: [
          {
            id: 'fake-read-aindexer',
            function: {
              name: 'read_file',
              arguments: JSON.stringify({ file: 'projects/aindexer/index.md' }),
            },
          },
        ],
      };
    }

    return {
      content: `你好！我是 Candidate Agent，可以帮你了解候选人 Kaho 的经历和项目。你问的是："${text}"`,
    };
  },
};
