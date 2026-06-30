import type { ChatRequest, ChatResponse, Provider, ToolCall } from './types';

interface OpenAiProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  defaultTemperature?: number;
  defaultReasoningEffort?: 'high' | 'max';
  defaultExtraBody?: Readonly<Record<string, unknown>>;
}

interface OpenAiToolCall {
  id: string;
  function: { name: string; arguments: string };
}

interface OpenAiMessage {
  content?: string;
  tool_calls?: OpenAiToolCall[];
}

interface OpenAiResponse {
  choices?: Array<{ message?: OpenAiMessage }>;
}

function normaliseBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}

function chatCompletionsUrl(baseUrl: string): string {
  const normalised = normaliseBaseUrl(baseUrl);
  return normalised.endsWith('/v1') ? `${normalised}/chat/completions` : `${normalised}/v1/chat/completions`;
}

export function createOpenAiCompatibleProvider(config: OpenAiProviderConfig): Provider {
  return {
    async chat(request: ChatRequest): Promise<ChatResponse> {
      const requestBody: Record<string, unknown> = {
        model: config.model,
        messages: request.messages,
      };

      if (request.tools) {
        requestBody.tools = request.tools;
      }

      const temperature = request.temperature ?? config.defaultTemperature;
      if (temperature !== undefined) {
        requestBody.temperature = temperature;
      }

      const reasoningEffort = request.reasoningEffort ?? config.defaultReasoningEffort;
      if (reasoningEffort) {
        requestBody.reasoning_effort = reasoningEffort;
      }

      const extraBody = request.extraBody ?? config.defaultExtraBody;
      if (extraBody) {
        requestBody.extra_body = extraBody;
      }

      const response = await fetch(chatCompletionsUrl(config.baseUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Provider request failed: HTTP ${response.status}`);
      }

      const payload = (await response.json()) as OpenAiResponse;
      const message = payload.choices?.[0]?.message;
      if (!message) {
        throw new Error('Provider response missing message');
      }

      return {
        content: message.content || '',
        tool_calls: message.tool_calls as ToolCall[] | undefined,
      };
    },
  };
}
