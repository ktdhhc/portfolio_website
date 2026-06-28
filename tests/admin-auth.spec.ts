import { test, expect } from '@playwright/test';
import { onRequestPost } from '../functions/api/admin/auth';
import { onRequest as adminMiddleware } from '../functions/api/admin/_middleware';
import { FakeRateLimitStore } from '../functions/api/_store/fake';

async function callAdminAuth(options?: {
  readonly token?: string;
  readonly ip?: string;
  readonly env?: Record<string, unknown>;
}) {
  return onRequestPost({
    request: new Request('http://localhost/api/admin/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-connecting-ip': options?.ip ?? '203.0.113.10',
      },
      body: JSON.stringify({ token: options?.token ?? 'secret-admin-token' }),
    }),
    env: {
      ADMIN_TOKEN: 'secret-admin-token',
      ...(options?.env ?? {}),
    },
  } as never);
}

test('021-01: POST /api/admin/auth 正确 token 返回 ok=true', async () => {
  const response = await callAdminAuth();

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ ok: true });
});

test('021-02: POST /api/admin/auth 错误 token 返回 invalid', async () => {
  const response = await callAdminAuth({ token: 'wrong-token' });

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ ok: false, reason: 'invalid' });
});

test('021-03: 连续失败超出阈值后返回 rate_limited', async () => {
  const fakeRateLimit = new FakeRateLimitStore();
  fakeRateLimit.adminFailureLimit = 2;

  const first = await callAdminAuth({ token: 'wrong-token', env: { RATE_LIMIT_STORE: fakeRateLimit } });
  await expect(first.json()).resolves.toEqual({ ok: false, reason: 'invalid' });

  const second = await callAdminAuth({ token: 'wrong-token', env: { RATE_LIMIT_STORE: fakeRateLimit } });
  await expect(second.json()).resolves.toEqual({ ok: false, reason: 'rate_limited' });
});

test('021-04: 冷却期后恢复登录尝试', async () => {
  const fakeRateLimit = new FakeRateLimitStore();
  fakeRateLimit.adminFailureLimit = 1;
  fakeRateLimit.adminCooldownMs = 60_000;

  const blocked = await callAdminAuth({ token: 'wrong-token', env: { RATE_LIMIT_STORE: fakeRateLimit } });
  await expect(blocked.json()).resolves.toEqual({ ok: false, reason: 'rate_limited' });

  fakeRateLimit.advanceTime(61_000);
  const recovered = await callAdminAuth({ token: 'secret-admin-token', env: { RATE_LIMIT_STORE: fakeRateLimit } });
  await expect(recovered.json()).resolves.toEqual({ ok: true });
});

test('021-05: admin middleware 在缺少 Authorization 时返回 401', async () => {
  let nextCalled = false;

  const response = await adminMiddleware({
    request: new Request('http://localhost/api/admin/stats/overview'),
    env: { ADMIN_TOKEN: 'secret-admin-token' },
    next: async () => {
      nextCalled = true;
      return new Response('ok');
    },
  } as never);

  expect(nextCalled).toBe(false);
  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
});

test('021-06: admin middleware 在错误 Bearer token 时返回 401', async () => {
  let nextCalled = false;

  const response = await adminMiddleware({
    request: new Request('http://localhost/api/admin/stats/overview', {
      headers: { Authorization: 'Bearer wrong-token' },
    }),
    env: { ADMIN_TOKEN: 'secret-admin-token' },
    next: async () => {
      nextCalled = true;
      return new Response('ok');
    },
  } as never);

  expect(nextCalled).toBe(false);
  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
});

test('021-07: /api/admin/auth 不受 admin middleware 保护', async () => {
  let nextCalled = false;

  const response = await adminMiddleware({
    request: new Request('http://localhost/api/admin/auth', { method: 'POST' }),
    env: { ADMIN_TOKEN: 'secret-admin-token' },
    next: async () => {
      nextCalled = true;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    },
  } as never);

  expect(nextCalled).toBe(true);
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ ok: true });
});
