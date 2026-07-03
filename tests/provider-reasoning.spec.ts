import { expect, test } from '@playwright/test';

import { getProvider } from '../functions/api/_providers/index';

test('provider exposes MiMo reasoning_content as thinkingContent', async () => {
  const provider = getProvider({
    ACTIVE_PROVIDER: 'mimo',
    MIMO_API_KEY: 'test-key',
    MIMO_BASE_URL: 'https://example.com',
    MIMO_MODEL: 'mimo-v2.5-pro',
    EFFORT: 'high',
  });

  const originalFetch = globalThis.fetch;
  const mockFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        id: 'mimo-response',
        choices: [
          {
            finish_reason: 'stop',
            index: 0,
            message: {
              role: 'assistant',
              content: '2 + 2 = 4。',
              tool_calls: null,
              reasoning_content: '我先确认问题很简单，再用一句话直接回答。',
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );

  Object.defineProperty(globalThis, 'fetch', {
    value: mockFetch,
    configurable: true,
    writable: true,
  });

  try {
    const result = await provider.chat({
      messages: [{ role: 'user', content: '2+2 等于几？' }],
    });

    expect(result.content).toBe('2 + 2 = 4。');
    expect(result.thinkingContent).toBe('我先确认问题很简单，再用一句话直接回答。');
  } finally {
    Object.defineProperty(globalThis, 'fetch', {
      value: originalFetch,
      configurable: true,
      writable: true,
    });
  }
});

test('provider exposes DeepSeek reasoning_content as thinkingContent', async () => {
  const provider = getProvider({
    ACTIVE_PROVIDER: 'deepseek',
    DEEPSEEK_API_KEY: 'test-key',
    DEEPSEEK_BASE_URL: 'https://example.com',
    DEEPSEEK_MODEL: 'deepseek-v4-pro',
    EFFORT: 'high',
  });

  const originalFetch = globalThis.fetch;
  const mockFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        id: 'deepseek-response',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '2+2等于4。',
              reasoning_content: '我先做最短计算，再用一句话给出结果。',
            },
            finish_reason: 'stop',
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );

  Object.defineProperty(globalThis, 'fetch', {
    value: mockFetch,
    configurable: true,
    writable: true,
  });

  try {
    const result = await provider.chat({
      messages: [{ role: 'user', content: '2+2 等于几？' }],
    });

    expect(result.content).toBe('2+2等于4。');
    expect(result.thinkingContent).toBe('我先做最短计算，再用一句话给出结果。');
  } finally {
    Object.defineProperty(globalThis, 'fetch', {
      value: originalFetch,
      configurable: true,
      writable: true,
    });
  }
});
