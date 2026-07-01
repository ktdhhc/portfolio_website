import { expect, test } from '@playwright/test';

import { getProvider, type ProviderEnv } from '../functions/api/_providers/index';

type ProviderRequestBody = Record<string, unknown>;
type ExtendedProviderEnv = ProviderEnv & {
  readonly TEMPERATURE?: string;
  readonly EFFORT?: string;
};

const stubProviderResponse = {
  choices: [{ message: { content: 'ok' } }],
} as const;

async function captureProviderRequestBody(env: ExtendedProviderEnv): Promise<ProviderRequestBody> {
  const provider = getProvider(env);
  const originalFetch = globalThis.fetch;
  let capturedBody: ProviderRequestBody | null = null;

  const mockFetch: typeof fetch = async (_input, init) => {
    if (typeof init?.body !== 'string') {
      throw new Error('Expected provider request body to be a JSON string');
    }

    const parsedBody = JSON.parse(init.body) as unknown;
    if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
      throw new Error('Expected provider request body to be a JSON object');
    }

    capturedBody = parsedBody as ProviderRequestBody;
    return new Response(JSON.stringify(stubProviderResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  Object.defineProperty(globalThis, 'fetch', {
    value: mockFetch,
    configurable: true,
    writable: true,
  });

  try {
    await provider.chat({
      messages: [{ role: 'user', content: 'hello' }],
    });
  } finally {
    Object.defineProperty(globalThis, 'fetch', {
      value: originalFetch,
      configurable: true,
      writable: true,
    });
  }

  if (!capturedBody) {
    throw new Error('Expected provider request body to be captured');
  }

  return capturedBody;
}

test('provider omits temperature and effort fields when unified env vars are absent', async () => {
  const body = await captureProviderRequestBody({
    ACTIVE_PROVIDER: 'deepseek',
    DEEPSEEK_API_KEY: 'test-key',
    DEEPSEEK_BASE_URL: 'https://example.com',
    DEEPSEEK_MODEL: 'deepseek-chat',
  });

  expect(body.temperature).toBeUndefined();
  expect(body.reasoning_effort).toBeUndefined();
  expect(body.extra_body).toBeUndefined();
});

test('deepseek maps unified env vars to temperature, reasoning effort, and enabled thinking', async () => {
  const body = await captureProviderRequestBody({
    ACTIVE_PROVIDER: 'deepseek',
    DEEPSEEK_API_KEY: 'test-key',
    DEEPSEEK_BASE_URL: 'https://example.com',
    DEEPSEEK_MODEL: 'deepseek-chat',
    TEMPERATURE: '0.7',
    EFFORT: 'high',
  });

  expect(body.temperature).toBe(0.7);
  expect(body.reasoning_effort).toBe('high');
  expect(body.extra_body).toEqual({
    thinking: {
      type: 'enabled',
    },
  });
});

test('mimo maps unified env vars without sending unsupported reasoning effort', async () => {
  const body = await captureProviderRequestBody({
    ACTIVE_PROVIDER: 'mimo',
    MIMO_API_KEY: 'test-key',
    MIMO_BASE_URL: 'https://example.com',
    MIMO_MODEL: 'mimo-v2.5-pro',
    TEMPERATURE: '0.7',
    EFFORT: 'high',
  });

  expect(body.temperature).toBe(0.7);
  expect(body.reasoning_effort).toBeUndefined();
  expect(body.extra_body).toEqual({
    thinking: {
      type: 'enabled',
    },
  });
});

test('provider maps disabled effort to disabled thinking without reasoning effort', async () => {
  const body = await captureProviderRequestBody({
    ACTIVE_PROVIDER: 'deepseek',
    DEEPSEEK_API_KEY: 'test-key',
    DEEPSEEK_BASE_URL: 'https://example.com',
    DEEPSEEK_MODEL: 'deepseek-chat',
    EFFORT: 'disabled',
  });

  expect(body.temperature).toBeUndefined();
  expect(body.reasoning_effort).toBeUndefined();
  expect(body.extra_body).toEqual({
    thinking: {
      type: 'disabled',
    },
  });
});

test('provider rejects invalid unified env values with clear errors', async () => {
  expect(() =>
    getProvider({
      ACTIVE_PROVIDER: 'deepseek',
      DEEPSEEK_API_KEY: 'test-key',
      DEEPSEEK_BASE_URL: 'https://example.com',
      DEEPSEEK_MODEL: 'deepseek-chat',
      TEMPERATURE: 'not-a-number',
    }),
  ).toThrow('TEMPERATURE must be a valid number');

  expect(() =>
    getProvider({
      ACTIVE_PROVIDER: 'deepseek',
      DEEPSEEK_API_KEY: 'test-key',
      DEEPSEEK_BASE_URL: 'https://example.com',
      DEEPSEEK_MODEL: 'deepseek-chat',
      EFFORT: 'weird',
    }),
  ).toThrow('EFFORT must be one of disabled|off|high|max');
});
