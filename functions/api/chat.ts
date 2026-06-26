/// <reference types="@cloudflare/workers-types" />

import { getProvider, type ProviderEnv } from './_providers/index';
import type { ChatMessage } from './_providers/types';
import { readAgentFile, readFileTool } from './_tools/read-file';
import { agentMaterials, readableAgentFileIds } from './_generated/agent-materials';

interface ChatRequestBody {
  messages?: ChatMessage[];
  stream?: boolean;
}

const maxToolRounds = 5;

function firstMeaningfulLine(content: string): string {
  return (
    content
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith('---') && !line.includes(': <')) || '候选人资料文件'
  );
}

function buildMainContext(): ChatMessage[] {
  const fileIndex = readableAgentFileIds
    .map((file) => `- ${file}: ${firstMeaningfulLine(agentMaterials[file])}`)
    .join('\n');

  return [
    {
      role: 'system',
      content: [
        agentMaterials['agent/system-prompt.md'],
        agentMaterials['agent/answer-rules.md'],
        `候选人 profile 摘要：\n${agentMaterials['profile.json']}`,
        `可通过 read_file 工具读取的文件索引：\n${fileIndex}`,
        '回答具体项目或简历细节前，应优先使用 read_file 读取相关文件；资料不足时明确说明无法确认。',
      ].join('\n\n'),
    },
  ];
}

function toJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function createStreamResponse(
  generator: AsyncGenerator<string, void, unknown>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        controller.enqueue(encoder.encode(sseEvent({ type: 'error', content: message })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}

export const onRequestPost: PagesFunction<ProviderEnv> = async (context) => {
  const body = (await context.request.json()) as ChatRequestBody;

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return toJsonResponse({ error: 'messages is required' }, 400);
  }

  try {
    const provider = getProvider(context.env);
    const messages = [...buildMainContext(), ...body.messages];

    if (body.stream) {
      return createStreamResponse(
        (async function* () {
          for (let round = 0; round < maxToolRounds; round += 1) {
            const response = await provider.chat({ messages, tools: [readFileTool] });

            if (!response.tool_calls || response.tool_calls.length === 0) {
              yield sseEvent({ type: 'delta', content: response.content });
              yield sseEvent({ type: 'done' });
              return;
            }

            messages.push({ role: 'assistant', content: response.content, tool_calls: response.tool_calls });

            for (const toolCall of response.tool_calls) {
              if (toolCall.function.name !== 'read_file') {
                throw new Error(`Unknown tool: ${toolCall.function.name}`);
              }
              const args = JSON.parse(toolCall.function.arguments) as { file?: string };
              if (!args.file) throw new Error('read_file requires file');

              yield sseEvent({ type: 'status', content: `正在查阅 ${args.file}` });

              const fileContent = readAgentFile(args.file);

              yield sseEvent({ type: 'tool_done', content: args.file });

              messages.push({
                role: 'tool',
                name: 'read_file',
                tool_call_id: toolCall.id,
                content: fileContent,
              });
            }
          }

          yield sseEvent({ type: 'delta', content: '已达到资料查阅上限，我会基于当前已读取的信息收尾回答。' });
          yield sseEvent({ type: 'done' });
        })(),
      );
    }

    // Non-streaming JSON path (unchanged)
    for (let round = 0; round < maxToolRounds; round += 1) {
      const response = await provider.chat({ messages, tools: [readFileTool] });
      if (!response.tool_calls || response.tool_calls.length === 0) {
        return toJsonResponse(response);
      }

      messages.push({ role: 'assistant', content: response.content, tool_calls: response.tool_calls });

      for (const toolCall of response.tool_calls) {
        if (toolCall.function.name !== 'read_file') {
          throw new Error(`Unknown tool: ${toolCall.function.name}`);
        }
        const args = JSON.parse(toolCall.function.arguments) as { file?: string };
        if (!args.file) throw new Error('read_file requires file');
        messages.push({
          role: 'tool',
          name: 'read_file',
          tool_call_id: toolCall.id,
          content: readAgentFile(args.file),
        });
      }
    }

    return toJsonResponse({ content: '已达到资料查阅上限，我会基于当前已读取的信息收尾回答。' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return toJsonResponse({ error: message }, 500);
  }
};
