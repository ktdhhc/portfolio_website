/// <reference types="@cloudflare/workers-types" />

import { resolveStores } from '../_store/d1';
import { StoreUnavailableError } from '../_store/errors';
import { extractClientIp, type AdminEnv, toJsonResponse } from './_shared';

type AdminAuthFailureReason = 'invalid' | 'rate_limited';

type AdminAuthSuccessResponse = {
  readonly ok: true;
};

type AdminAuthFailureResponse = {
  readonly ok: false;
  readonly reason: AdminAuthFailureReason;
};

function hasTokenPayload(value: unknown): value is { readonly token: string } {
  if (typeof value !== 'object' || value === null) return false;
  if (!Object.prototype.hasOwnProperty.call(value, 'token')) return false;
  return typeof Reflect.get(value, 'token') === 'string';
}

function invalidResponse(): Response {
  const payload: AdminAuthFailureResponse = { ok: false, reason: 'invalid' };
  return toJsonResponse(payload);
}

function rateLimitedResponse(): Response {
  const payload: AdminAuthFailureResponse = { ok: false, reason: 'rate_limited' };
  return toJsonResponse(payload);
}

export const onRequestPost: PagesFunction<AdminEnv> = async (context) => {
  if (!context.env.ADMIN_TOKEN) {
    return toJsonResponse({ error: 'ADMIN_TOKEN is required' }, 500);
  }

  const stores = resolveStores(context.env);
  const rateLimitStore = stores.rateLimitStore;
  const clientIp = extractClientIp(context.request);

  try {
    const rateLimitResult = await rateLimitStore.checkAdminLoginRateLimit(clientIp);
    if (!rateLimitResult.allowed) {
      return rateLimitedResponse();
    }
  } catch (error) {
    if (!(error instanceof StoreUnavailableError)) throw error;
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return invalidResponse();
    }
    throw error;
  }

  if (!hasTokenPayload(body)) {
    return invalidResponse();
  }

  if (body.token === context.env.ADMIN_TOKEN) {
    try {
      await rateLimitStore.resetAdminLoginFailures(clientIp);
    } catch (error) {
      if (!(error instanceof StoreUnavailableError)) throw error;
    }

    const payload: AdminAuthSuccessResponse = { ok: true };
    return toJsonResponse(payload);
  }

  try {
    const rateLimitResult = await rateLimitStore.recordAdminLoginFailure(clientIp);
    if (!rateLimitResult.allowed) {
      return rateLimitedResponse();
    }
  } catch (error) {
    if (!(error instanceof StoreUnavailableError)) throw error;
  }

  return invalidResponse();
};
