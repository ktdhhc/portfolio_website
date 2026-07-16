import type { Provider } from './types';
import { fakeProvider } from './fake';
import { createOpenAiCompatibleProvider } from './openai-compatible';
import { maxToolRounds } from '../_config/agent-constants';

export interface ProviderEnv {
  ACTIVE_PROVIDER?: string;
  AGENT_CONTEXT_SECRET?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_MODEL?: string;
  MIMO_API_KEY?: string;
  MIMO_BASE_URL?: string;
  MIMO_MODEL?: string;
  TEMPERATURE?: string;
  EFFORT?: string;
}

/** Admin 面板展示用的 Agent 运行配置快照。 */
export interface ResolvedAgentConfig {
  readonly provider: string;
  readonly model: string | null;
  readonly temperature: number | null;
  readonly effort: string | null;
  readonly toolLoopCap: number;
}

type ProviderThinkingEffort = 'disabled' | 'high' | 'max';

function parseTemperature(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`TEMPERATURE must be a valid number, received: ${value}`);
  }
  return parsed;
}

function parseThinkingEffort(value: string | undefined): ProviderThinkingEffort | undefined {
  if (!value) return undefined;

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
      throw new Error(`EFFORT must be one of disabled|off|high|max, received: ${value}`);
  }
}

/** 解析当前环境变量，返回 Agent 运行配置快照。不创建 provider 实例。 */
export function resolveAgentConfig(env: ProviderEnv): ResolvedAgentConfig {
  const provider = env.ACTIVE_PROVIDER || 'test';
  const temperature = parseTemperature(env.TEMPERATURE) ?? null;
  const rawEffort = parseThinkingEffort(env.EFFORT);
  const effort: string | null = rawEffort ?? null;

  let model: string | null = null;
  if (provider === 'deepseek') model = env.DEEPSEEK_MODEL ?? null;
  else if (provider === 'mimo') model = env.MIMO_MODEL ?? null;

  return { provider, model, temperature, effort, toolLoopCap: maxToolRounds };
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
  const temperature = parseTemperature(env.TEMPERATURE);
  const thinkingEffort = parseThinkingEffort(env.EFFORT);

  switch (env.ACTIVE_PROVIDER || 'test') {
    case 'test':
      return fakeProvider;
    case 'deepseek':
      return createOpenAiCompatibleProvider({
        apiKey: requireEnv(env.DEEPSEEK_API_KEY, 'DEEPSEEK_API_KEY'),
        baseUrl: requireEnv(env.DEEPSEEK_BASE_URL, 'DEEPSEEK_BASE_URL'),
        model: requireEnv(env.DEEPSEEK_MODEL, 'DEEPSEEK_MODEL'),
        defaultTemperature: temperature,
        defaultReasoningEffort: thinkingEffort && thinkingEffort !== 'disabled' ? thinkingEffort : undefined,
        defaultExtraBody: thinkingEffort ? toThinkingExtraBody(thinkingEffort) : undefined,
      });
    case 'mimo':
      return createOpenAiCompatibleProvider({
        apiKey: requireEnv(env.MIMO_API_KEY, 'MIMO_API_KEY'),
        baseUrl: requireEnv(env.MIMO_BASE_URL, 'MIMO_BASE_URL'),
        model: requireEnv(env.MIMO_MODEL, 'MIMO_MODEL'),
        defaultTemperature: temperature,
        defaultExtraBody: thinkingEffort ? toThinkingExtraBody(thinkingEffort) : undefined,
      });
    default:
      throw new Error(`Unknown ACTIVE_PROVIDER: ${env.ACTIVE_PROVIDER}`);
  }
}
