/// <reference types="@cloudflare/workers-types" />

import type { StoreEnv, BehaviorEventRecord } from './_store/types';
import { resolveStores } from './_store/d1';

interface IncomingEvent {
  type: string;
  agentSessionId?: string;
  path?: string;
  targetKind?: string;
  targetId?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

interface TrackRequestBody {
  visitorUuid?: string;
  events?: IncomingEvent[];
}

export const onRequestPost: PagesFunction<StoreEnv> = async (context) => {
  const body = (await context.request.json()) as TrackRequestBody;

  if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
    return new Response(JSON.stringify({ error: 'events is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const stores = resolveStores(context.env);
  const store = stores.behaviorEventStore;
  const visitorUuid = body.visitorUuid ?? 'anonymous';
  const now = new Date().toISOString();

  const records: BehaviorEventRecord[] = body.events.map((event) => ({
    visitorUuid,
    agentSessionId: event.agentSessionId,
    eventType: event.type,
    path: event.path,
    targetKind: event.targetKind,
    targetId: event.targetId,
    durationMs: event.durationMs,
    metadata: event.metadata,
    createdAt: now,
  }));

  try {
    await store.insertEvents(records);
  } catch {
    // D1 退化：记录写入失败不阻断响应，静默失败。
  }

  return new Response(null, { status: 200 });
};
