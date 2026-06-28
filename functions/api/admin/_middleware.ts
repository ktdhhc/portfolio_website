/// <reference types="@cloudflare/workers-types" />

import { extractBearerToken, type AdminEnv, toJsonResponse } from './_shared';

export const onRequest: PagesFunction<AdminEnv> = async (context) => {
  const pathname = new URL(context.request.url).pathname;
  if (pathname === '/api/admin/auth') {
    return context.next();
  }

  if (!context.env.ADMIN_TOKEN) {
    return toJsonResponse({ error: 'ADMIN_TOKEN is required' }, 500);
  }

  const bearerToken = extractBearerToken(context.request);
  if (!bearerToken || bearerToken !== context.env.ADMIN_TOKEN) {
    return toJsonResponse({ error: 'Unauthorized' }, 401);
  }

  return context.next();
};
