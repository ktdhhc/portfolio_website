import type { Provider } from './types';
import { fakeProvider } from './fake';
import { createOpenAiCompatibleProvider } from './openai-compatible';

export interface ProviderEnv {
  ACTIVE_PROVIDER?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_MODEL?: string;
  MIMO_API_KEY?: string;
  MIMO_BASE_URL?: string;
  MIMO_MODEL?: string;
  CHAT_TEMPERATURE?: string;
  CHAT_THINKING_EFFORT?: string;
}

type ProviderThinkingEffort = 'disabled' | 'high' | 'max';

const defaultChatTemperature = 0.7;
const defaultChatThinkingEffort: ProviderThinkingEffort = 'high';

function parseChatTemperature(value: string | undefined): number {
  if (!value) return defaultChatTemperature;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`CHAT_TEMPERATURE must be a valid number, received: ${value}`);
  }
  return parsed;
}

function parseChatThinkingEffort(value: string | undefined): ProviderThinkingEffort {
  if (!value) return defaultChatThinkingEffort;

  switch (value.trim().toLowerCase()) {
    case 'disabled':
    case 'off':
      return 'disabled';
    case 'high':
    case 'low':
    case 'medium':
      return 'high';
    case 'max':
    case 'xhigh':
      return 'max';
    default:
      throw new Error(`CHAT_THINKING_EFFORT must be one of disabled|off|high|max, received: ${value}`);
  }
}

function toThinkingExtraBody(effort: ProviderThinkingEffort): Readonly<Record<string, unknown>> {
  return {
    thinking: {
      type: effort === 'disabled' ? 'disabled' : 'enabled',
    },
  };
}

// 根据环境变量 ACTIVE_PROVIDER 返回当前生效供应商。
// 部署时确定，不可运行时切换（ADR-0002）。
function requireEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function getProvider(env: ProviderEnv): Provider {
  const temperature = parseChatTemperature(env.CHAT_TEMPERATURE);
  const thinkingEffort = parseChatThinkingEffort(env.CHAT_THINKING_EFFORT);

  switch (env.ACTIVE_PROVIDER || 'test') {
    case 'test':
      return fakeProvider;
    case 'deepseek':
      return createOpenAiCompatibleProvider({
        apiKey: requireEnv(env.DEEPSEEK_API_KEY, 'DEEPSEEK_API_KEY'),
        baseUrl: requireEnv(env.DEEPSEEK_BASE_URL, 'DEEPSEEK_BASE_URL'),
        model: requireEnv(env.DEEPSEEK_MODEL, 'DEEPSEEK_MODEL'),
        defaultTemperature: temperature,
        defaultReasoningEffort: thinkingEffort === 'disabled' ? undefined : thinkingEffort,
        defaultExtraBody: toThinkingExtraBody(thinkingEffort),
      });
    case 'mimo':
      return createOpenAiCompatibleProvider({
        apiKey: requireEnv(env.MIMO_API_KEY, 'MIMO_API_KEY'),
        baseUrl: requireEnv(env.MIMO_BASE_URL, 'MIMO_BASE_URL'),
        model: requireEnv(env.MIMO_MODEL, 'MIMO_MODEL'),
        defaultTemperature: temperature,
        defaultExtraBody: toThinkingExtraBody(thinkingEffort),
      });
    default:
      throw new Error(`Unknown ACTIVE_PROVIDER: ${env.ACTIVE_PROVIDER}`);
  }
}
