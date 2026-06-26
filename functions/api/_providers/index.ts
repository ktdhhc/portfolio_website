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
}

// 根据环境变量 ACTIVE_PROVIDER 返回当前生效供应商。
// 部署时确定，不可运行时切换（ADR-0002）。
function requireEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function getProvider(env: ProviderEnv): Provider {
  switch (env.ACTIVE_PROVIDER || 'test') {
    case 'test':
      return fakeProvider;
    case 'deepseek':
      return createOpenAiCompatibleProvider({
        apiKey: requireEnv(env.DEEPSEEK_API_KEY, 'DEEPSEEK_API_KEY'),
        baseUrl: requireEnv(env.DEEPSEEK_BASE_URL, 'DEEPSEEK_BASE_URL'),
        model: requireEnv(env.DEEPSEEK_MODEL, 'DEEPSEEK_MODEL'),
      });
    case 'mimo':
      return createOpenAiCompatibleProvider({
        apiKey: requireEnv(env.MIMO_API_KEY, 'MIMO_API_KEY'),
        baseUrl: requireEnv(env.MIMO_BASE_URL, 'MIMO_BASE_URL'),
        model: requireEnv(env.MIMO_MODEL, 'MIMO_MODEL'),
      });
    default:
      throw new Error(`Unknown ACTIVE_PROVIDER: ${env.ACTIVE_PROVIDER}`);
  }
}
