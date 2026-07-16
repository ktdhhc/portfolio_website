/// <reference types="@cloudflare/workers-types" />

import { getProvider, type ProviderEnv } from './_providers/index';
import type { ChatMessage } from './_providers/types';
import { getAgentFilePublicName, readAgentFile, readFileTool } from './_tools/read-file';
import { agentMaterials, readableAgentFileIds } from './_generated/agent-materials';
import type { StoreEnv, AgentTurnRecord, AgentTurnStatus, RateLimitResult } from './_store/types';
import { resolveStores } from './_store/d1';
import { maxToolRounds } from './_config/agent-constants';
import { openAgentContext, sealAgentContext } from './_context/context-token';

interface ChatRequestBody {
  message?: string;
  contextToken?: string;
  visitorUuid?: string;
  agentSessionId?: string;
  turnType?: string;
}

function firstMeaningfulLine(content: string, fileId?: string): string {
  // 对于项目 index.md 文件，提取 name 和 tagline 拼接显示
  if (fileId && fileId.startsWith('projects/') && fileId.endsWith('/index.md')) {
    const lines = content.split('\n').map((line) => line.trim());
    let name = '';
    let tagline = '';
    for (const line of lines) {
      if (line.startsWith('name: ')) name = line.slice(6);
      if (line.startsWith('tagline: ')) tagline = line.slice(9);
      if (name && tagline) break;
    }
    if (name && tagline) return `${name} — ${tagline}`;
    if (name) return name;
  }

  // 对于其他文件，保持原来的行为
  return (
    content
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith('---') && !line.includes(': <')) || '候选人资料文件'
  );
}

function buildMainContext(): ChatMessage[] {
  const fileIndex = readableAgentFileIds
    .map((file) => `- ${file}: ${firstMeaningfulLine(agentMaterials[file], file)}`)
    .join('\n');

  return [
    {
      role: 'system',
      content: [
        agentMaterials['agent/system-prompt.md'],
        agentMaterials['agent/answer-rules.md'],
        `候选人 profile 摘要：\n${agentMaterials['profile.json']}`,
        `可通过 read_file 工具读取的文件索引：\n${fileIndex}`,
        '当访客询问任何具体项目时，你必须直接读取对应的项目文件（如 projects/{slug}/index.md）。如果问题需要综合多个项目、简历或参考资料，请先判断所需文件，并在同一轮中一次发起多个 read_file 调用；不要默认一轮只读一个文件。只有在读取了必要资料后才能回答。',
      ].join('\n\n'),
    },
  ];
}

const materialDumpRefusal = '不能直接提供整份参考资料或大段原文。你可以提出具体问题，我会基于资料进行概括、说明或使用必要的短句引用。';

function normalizeExcerpt(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function protectReferenceMaterial(answer: string): string {
  if (/projects\/[\w-]+\/(?:refs\/)?[^\s)]+\.md/i.test(answer) || answer.includes('read_file')) {
    return materialDumpRefusal;
  }

  const normalizedAnswer = normalizeExcerpt(answer);
  if (normalizedAnswer.length < 240) return answer;

  const referenceMaterials = readableAgentFileIds
    .filter((file) => file.includes('/refs/'))
    .map((file) => normalizeExcerpt(agentMaterials[file]));
  for (let offset = 0; offset + 240 <= normalizedAnswer.length; offset += 120) {
    const excerpt = normalizedAnswer.slice(offset, offset + 240);
    if (referenceMaterials.some((material) => material.includes(excerpt))) {
      return materialDumpRefusal;
    }
  }
  return answer;
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
  const contentLength = Number(context.request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > 1_000_000) {
    return toJsonResponse({ error: 'request_too_large' }, 413);
  }
  const requestText = await context.request.text();
  if (requestText.length > 1_000_000) {
    return toJsonResponse({ error: 'request_too_large' }, 413);
  }
  let body: ChatRequestBody;
  try {
    body = JSON.parse(requestText) as ChatRequestBody;
  } catch {
    return toJsonResponse({ error: 'invalid_json' }, 400);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'messages')) {
    return toJsonResponse({ error: 'messages is not allowed' }, 400);
  }

  const hasCurrentMessage = typeof body.message === 'string' && body.message.trim().length > 0;
  if (!hasCurrentMessage) {
    return toJsonResponse({ error: 'message is required' }, 400);
  }
  if (body.message!.length > 30_000 || (body.contextToken?.length ?? 0) > 750_000) {
    return toJsonResponse({ error: 'request_too_large' }, 413);
  }

  if (hasCurrentMessage && !context.env.AGENT_CONTEXT_SECRET) {
    return toJsonResponse({ error: 'AGENT_CONTEXT_SECRET is required' }, 500);
  }

  const visitorUuid = body.visitorUuid ?? 'anonymous';
  const agentSessionId = body.agentSessionId ?? 'unknown';
  const turnType = body.turnType ?? 'chat';
  let priorMessages: ChatMessage[] = [];
  if (body.contextToken) {
    try {
      priorMessages = await openAgentContext(context.env.AGENT_CONTEXT_SECRET!, body.contextToken, { visitorUuid, agentSessionId });
    } catch {
      return toJsonResponse({ error: 'invalid_context' }, 400);
    }
  }
  const userMessage = body.message!.trim();
  const requestMessages: ChatMessage[] = [...priorMessages, { role: 'user', content: userMessage }];
  const stores = resolveStores(context.env);
  const turnStore = stores.agentTurnStore;
  const rateLimitStore = stores.rateLimitStore;

  try {
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
        const canonicalTurnMessages: ChatMessage[] = [];
        let status: AgentTurnStatus = 'success';

        try {
          const provider = getProvider(context.env);
          const messages = [...buildMainContext(), ...requestMessages];

          for (let round = 0; round < maxToolRounds; round += 1) {
            const response = await provider.chat({ messages, tools: [readFileTool] });

            if (!response.tool_calls || response.tool_calls.length === 0) {
              finalAnswer = protectReferenceMaterial(response.content);
              const finalAssistantMessage: ChatMessage = {
                role: 'assistant',
                content: finalAnswer,
              };
              if (response.thinkingContent) {
                finalAssistantMessage.reasoning_content = response.thinkingContent;
              }
              canonicalTurnMessages.push(finalAssistantMessage);
              yield sseEvent({ type: 'delta', content: finalAnswer });
              const token = await sealAgentContext(context.env.AGENT_CONTEXT_SECRET!, {
                visitorUuid,
                agentSessionId,
                messages: [...requestMessages, ...canonicalTurnMessages],
              });
              yield sseEvent({ type: 'context', token });
              yield sseEvent({ type: 'done' });
              return;
            }

            const assistantToolMessage: ChatMessage = {
              role: 'assistant',
              content: response.content,
              tool_calls: response.tool_calls,
            };
            if (response.thinkingContent) {
              assistantToolMessage.reasoning_content = response.thinkingContent;
            }
            canonicalTurnMessages.push(assistantToolMessage);
            messages.push(assistantToolMessage);

            for (const toolCall of response.tool_calls) {
              if (toolCall.function.name !== 'read_file') {
                throw new Error(`Unknown tool: ${toolCall.function.name}`);
              }
              try {
                const args = JSON.parse(toolCall.function.arguments) as { file?: string };
                if (!args.file) throw new Error('read_file requires file');

                const fileContent = readAgentFile(args.file);
                const publicName = getAgentFilePublicName(args.file);
                yield sseEvent({ type: 'source', name: publicName, state: 'started' });
                toolFiles.push(args.file);

                yield sseEvent({ type: 'source', name: publicName, state: 'completed' });

                const toolMessage: ChatMessage = {
                  role: 'tool',
                  name: 'read_file',
                  tool_call_id: toolCall.id,
                  content: fileContent,
                };
                messages.push(toolMessage);
                canonicalTurnMessages.push(toolMessage);
              } catch {
                status = 'degraded';
                finalAnswer = '查阅部分资料时遇到问题，我会基于当前已读取的信息继续回答。';
                yield sseEvent({ type: 'delta', content: finalAnswer });
                const token = await sealAgentContext(context.env.AGENT_CONTEXT_SECRET!, {
                  visitorUuid,
                  agentSessionId,
                  messages: [...requestMessages, { role: 'assistant', content: finalAnswer }],
                });
                yield sseEvent({ type: 'context', token });
                yield sseEvent({ type: 'done' });
                return;
              }
            }
          }

          status = 'degraded';
          finalAnswer = '已达到资料查阅上限，我会基于当前已读取的信息收尾回答。';
          yield sseEvent({ type: 'delta', content: finalAnswer });
          const token = await sealAgentContext(context.env.AGENT_CONTEXT_SECRET!, {
            visitorUuid,
            agentSessionId,
            messages: [...requestMessages, ...canonicalTurnMessages, { role: 'assistant', content: finalAnswer }],
          });
          yield sseEvent({ type: 'context', token });
          yield sseEvent({ type: 'done' });
        } catch (err) {
          status = 'failed';
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
