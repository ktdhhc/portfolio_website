/// <reference types="@cloudflare/workers-types" />

import { getProvider, type ProviderEnv } from './_providers/index';
import type { ChatMessage } from './_providers/types';
import { readAgentFile, readFileTool } from './_tools/read-file';
import { agentMaterials, readableAgentFileIds } from './_generated/agent-materials';
import type { StoreEnv, AgentTurnRecord, RateLimitResult } from './_store/types';
import { resolveStores } from './_store/d1';

interface ChatRequestBody {
  messages?: ChatMessage[];
  visitorUuid?: string;
  agentSessionId?: string;
  turnType?: string;
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

export const onRequestPost: PagesFunction<ProviderEnv & StoreEnv> = async (context) => {
  const body = (await context.request.json()) as ChatRequestBody;

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return toJsonResponse({ error: 'messages is required' }, 400);
  }

  try {
    const provider = getProvider(context.env);
    const messages = [...buildMainContext(), ...body.messages];
    const userMessage = body.messages[body.messages.length - 1]?.content ?? '';
    const visitorUuid = body.visitorUuid ?? 'anonymous';
    const agentSessionId = body.agentSessionId ?? 'unknown';
    const turnType = body.turnType ?? 'chat';
    const stores = resolveStores(context.env);
    const turnStore = stores.agentTurnStore;
    const rateLimitStore = stores.rateLimitStore;

    // 限频检查（按 Agent Turn 计数，在 provider 调用前执行）
    let rateLimitResult: RateLimitResult = { allowed: true };
    try {
      rateLimitResult = await rateLimitStore.checkAndIncrement(visitorUuid);
    } catch {
      // D1 退化：限频检查失败，放行请求
    }

    if (!rateLimitResult.allowed) {
      const message = rateLimitResult.reason === 'uuid_limit'
        ? '您本小时的提问次数已达上限，请稍后再试，或查看静态简历和项目页了解更多。'
        : '今日 Agent 已达上限，请查看静态简历和项目页了解更多。';
      return createStreamResponse(
        (async function* () {
          yield sseEvent({ type: 'delta', content: message });
          yield sseEvent({ type: 'done' });
        })(),
      );
    }

    return createStreamResponse(
      (async function* () {
        const startTime = Date.now();
        let finalAnswer = '';
        const toolFiles: string[] = [];
        let status = 'success';

        try {
          for (let round = 0; round < maxToolRounds; round += 1) {
            const response = await provider.chat({ messages, tools: [readFileTool] });

            if (!response.tool_calls || response.tool_calls.length === 0) {
              finalAnswer = response.content;
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
              toolFiles.push(args.file);

              yield sseEvent({ type: 'tool_done', content: args.file });

              messages.push({
                role: 'tool',
                name: 'read_file',
                tool_call_id: toolCall.id,
                content: fileContent,
              });
            }
          }

          finalAnswer = '已达到资料查阅上限，我会基于当前已读取的信息收尾回答。';
          yield sseEvent({ type: 'delta', content: finalAnswer });
          yield sseEvent({ type: 'done' });
        } catch (err) {
          status = 'error';
          throw err;
        } finally {
          const record: AgentTurnRecord = {
            visitorUuid,
            agentSessionId,
            turnType,
            userMessage,
            assistantAnswer: finalAnswer,
            answerStatus: status,
            durationMs: Date.now() - startTime,
            toolTrace: toolFiles.length > 0 ? { toolCalls: toolFiles.length, files: toolFiles } : undefined,
            createdAt: new Date().toISOString(),
          };
          try {
            await turnStore.insertTurn(record);
          } catch {
            // D1 退化：turn 写入失败不阻断响应
          }
        }
      })(),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return toJsonResponse({ error: message }, 500);
  }
};
