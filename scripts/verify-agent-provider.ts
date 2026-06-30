import { readFileSync } from 'node:fs';
import { onRequestPost } from '../functions/api/chat';
import type { ProviderEnv } from '../functions/api/_providers/index';

function loadDotEnv() {
  const envText = readFileSync('.env', 'utf-8');
  for (const line of envText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function envForProvider(provider: string): ProviderEnv {
  return {
    ACTIVE_PROVIDER: provider,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL,
    DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL,
    MIMO_API_KEY: process.env.MIMO_API_KEY,
    MIMO_BASE_URL: process.env.MIMO_BASE_URL,
    MIMO_MODEL: process.env.MIMO_MODEL,
    CHAT_TEMPERATURE: process.env.CHAT_TEMPERATURE,
    CHAT_THINKING_EFFORT: process.env.CHAT_THINKING_EFFORT,
  };
}

async function verify(provider: string) {
  const response = await onRequestPost({
    request: new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content:
              '请先使用 read_file 读取 projects/aindexer/index.md，然后只用一句话回答：Aindexer 的技术栈是什么？',
          },
        ],
      }),
    }),
    env: envForProvider(provider),
  } as never);

  const text = await response.text();
  if (response.status !== 200) {
    throw new Error(`${provider} failed with HTTP ${response.status}: ${text.slice(0, 400)}`);
  }

  // 解析 SSE 提取 delta content
  const events = text.split('\n\n').filter((e) => e.startsWith('data:'));
  let content = '';
  for (const event of events) {
    const json = JSON.parse(event.replace(/^data:\s*/, ''));
    if (json.type === 'delta') content = json.content || '';
    if (json.type === 'error') throw new Error(json.content || 'Unknown error');
  }

  if (!/(FastAPI|SQLite|React|RAG)/i.test(content)) {
    throw new Error(`${provider} response did not include expected Aindexer material keyword: ${content.slice(0, 400)}`);
  }

  console.log(`${provider}: OK`);
}

loadDotEnv();

const providers = process.argv.slice(2);
const selectedProviders = providers.length > 0 ? providers : ['deepseek', 'mimo'];

for (const provider of selectedProviders) {
  await verify(provider);
}
