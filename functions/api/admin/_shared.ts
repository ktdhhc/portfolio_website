/// <reference types="@cloudflare/workers-types" />

import type { StoreEnv } from '../_store/types';

export interface AdminEnv extends StoreEnv {
  ADMIN_TOKEN?: string;
}

export function toJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function extractBearerToken(request: Request): string | null {
  const authorization = request.headers.get('Authorization');
  if (!authorization) return null;

  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

export function extractClientIp(request: Request): string {
  const cloudflareIp = request.headers.get('cf-connecting-ip');
  if (cloudflareIp) return cloudflareIp.trim();

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (!forwardedFor) return 'unknown';

  const [firstIp] = forwardedFor.split(',');
  return firstIp?.trim() || 'unknown';
}
