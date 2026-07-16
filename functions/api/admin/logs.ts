/// <reference types="@cloudflare/workers-types" />

import { resolveStores } from '../_store/d1';
import { StoreUnavailableError } from '../_store/errors';
import type { AgentTurnRecord } from '../_store/types';
import { getCustomWindow, InvalidDateRangeError, resolveWindow } from './_period';
import { type AdminEnv, toJsonResponse } from './_shared';

type LogsFailureResponse = {
  readonly ok: false;
  readonly reason: 'db_unavailable';
};

type LogsListItem = {
  readonly id: string;
  readonly visitorUuidShort: string;
  readonly agentSessionIdShort: string;
  readonly startedAt: string;
  readonly lastTurnAt: string;
  readonly turnCount: number;
  readonly latestUserMessage: string;
};

type LogsDetailItem = {
  readonly id: string;
  readonly createdAt: string;
  readonly userMessage: string;
  readonly assistantAnswer: string;
  readonly turnType: string;
  readonly answerStatus: AgentTurnRecord['answerStatus'];
  readonly durationMs: number;
  readonly toolTraceSummary: {
    readonly toolCalls: number;
    readonly files: readonly string[];
  };
  readonly visitorUuidShort: string;
  readonly agentSessionIdShort: string;
};

type LogsSessionDetail = {
  readonly id: string;
  readonly visitorUuidShort: string;
  readonly agentSessionIdShort: string;
  readonly startedAt: string;
  readonly lastTurnAt: string;
  readonly turnCount: number;
};

type LogsSessionTurnItem = {
  readonly id: string;
  readonly createdAt: string;
  readonly userMessage: string;
  readonly turnType: string;
  readonly answerStatus: AgentTurnRecord['answerStatus'];
};

type LogsResponse = LogsFailureResponse | {
  readonly ok: true;
  readonly data: {
    readonly items: readonly LogsListItem[];
    readonly total: number;
    readonly page: number;
    readonly pageSize: number;
    readonly totalPages: number;
  };
} | {
  readonly ok: true;
  readonly data: {
    readonly session: LogsSessionDetail;
    readonly turns: readonly LogsSessionTurnItem[];
  };
} | {
  readonly ok: true;
  readonly data: {
    readonly item: LogsDetailItem | null;
  };
};

function parsePositivePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parsePageSize(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return 20;
  return Math.min(parsed, 100);
}

function summarizeToolTrace(toolTrace: AgentTurnRecord['toolTrace']): LogsDetailItem['toolTraceSummary'] {
  if (!toolTrace) return { toolCalls: 0, files: [] };

  const rawToolCalls = Reflect.get(toolTrace, 'toolCalls');
  const rawFiles = Reflect.get(toolTrace, 'files');
  const toolCalls = typeof rawToolCalls === 'number' ? rawToolCalls : 0;
  const files = Array.isArray(rawFiles) ? rawFiles.filter((value): value is string => typeof value === 'string') : [];
  return { toolCalls, files };
}

function toSessionList(records: readonly AgentTurnRecord[]): readonly LogsListItem[] {
  const sessions = new Map<string, {
    visitorUuidShort: string;
    agentSessionIdShort: string;
    startedAt: string;
    lastTurnAt: string;
    turnCount: number;
    latestUserMessage: string;
  }>();

  for (const record of records) {
    const existing = sessions.get(record.agentSessionId);
    if (!existing) {
      sessions.set(record.agentSessionId, {
        visitorUuidShort: record.visitorUuid.slice(0, 8),
        agentSessionIdShort: record.agentSessionId.slice(0, 8),
        startedAt: record.createdAt,
        lastTurnAt: record.createdAt,
        turnCount: 1,
        latestUserMessage: record.userMessage.length <= 80 ? record.userMessage : record.userMessage.slice(0, 80),
      });
      continue;
    }

    existing.turnCount += 1;
    if (record.createdAt < existing.startedAt) {
      existing.startedAt = record.createdAt;
    }
    if (record.createdAt >= existing.lastTurnAt) {
      existing.lastTurnAt = record.createdAt;
      existing.latestUserMessage = record.userMessage.length <= 80 ? record.userMessage : record.userMessage.slice(0, 80);
    }
  }

  return Array.from(sessions.entries())
    .map(([agentSessionId, session]) => ({
      id: agentSessionId,
      visitorUuidShort: session.visitorUuidShort,
      agentSessionIdShort: session.agentSessionIdShort,
      startedAt: session.startedAt,
      lastTurnAt: session.lastTurnAt,
      turnCount: session.turnCount,
      latestUserMessage: session.latestUserMessage,
    }))
    .sort((left, right) => right.lastTurnAt.localeCompare(left.lastTurnAt) || right.id.localeCompare(left.id));
}

function toDetailItem(record: AgentTurnRecord): LogsDetailItem {
  return {
    id: record.id ?? '',
    createdAt: record.createdAt,
    userMessage: record.userMessage,
    assistantAnswer: record.assistantAnswer,
    turnType: record.turnType,
    answerStatus: record.answerStatus,
    durationMs: record.durationMs,
    toolTraceSummary: summarizeToolTrace(record.toolTrace),
    visitorUuidShort: record.visitorUuid.slice(0, 8),
    agentSessionIdShort: record.agentSessionId.slice(0, 8),
  };
}

function toSessionTurnItem(record: AgentTurnRecord): LogsSessionTurnItem {
  return {
    id: record.id ?? '',
    createdAt: record.createdAt,
    userMessage: record.userMessage.length <= 80 ? record.userMessage : record.userMessage.slice(0, 80),
    turnType: record.turnType,
    answerStatus: record.answerStatus,
  };
}

function dbUnavailableResponse(): LogsFailureResponse {
  return { ok: false, reason: 'db_unavailable' };
}

export const onRequestGet: PagesFunction<AdminEnv> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const { current } = resolveWindow(url);
    const stores = resolveStores(context.env);
    const logId = url.searchParams.get('id');
    const sessionId = url.searchParams.get('sessionId');

    if (sessionId) {
      const turns = (await stores.agentTurnStore.listTurns(current))
        .filter((record) => record.agentSessionId === sessionId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || String(left.id ?? '').localeCompare(String(right.id ?? '')));

      const session = toSessionList(turns)[0];
      const response: LogsResponse = {
        ok: true,
        data: {
          session: {
            id: sessionId,
            visitorUuidShort: session?.visitorUuidShort ?? '',
            agentSessionIdShort: session?.agentSessionIdShort ?? sessionId.slice(0, 8),
            startedAt: session?.startedAt ?? '',
            lastTurnAt: session?.lastTurnAt ?? '',
            turnCount: session?.turnCount ?? 0,
          },
          turns: turns.map(toSessionTurnItem),
        },
      };
      return toJsonResponse(response);
    }

    if (logId) {
      const record = await stores.agentTurnStore.getLogDetail(logId, current);
      const response: LogsResponse = {
        ok: true,
        data: {
          item: record ? toDetailItem(record) : null,
        },
      };
      return toJsonResponse(response);
    }

    const page = parsePositivePage(url.searchParams.get('page'));
    const pageSize = parsePageSize(url.searchParams.get('pageSize'));
    const turns = await stores.agentTurnStore.listTurns(current);
    const sessions = toSessionList(turns);
    const total = sessions.length;
    const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;
    const response: LogsResponse = {
      ok: true,
      data: {
        items: sessions.slice(offset, offset + pageSize),
        total,
        page,
        pageSize,
        totalPages,
      },
    };
    return toJsonResponse(response);
  } catch (error) {
    if (error instanceof InvalidDateRangeError) {
      return toJsonResponse({ ok: false, reason: 'invalid_date_range' }, 400);
    }
    if (error instanceof StoreUnavailableError) {
      return toJsonResponse(dbUnavailableResponse());
    }
    throw error;
  }
};

type DeleteResponse = LogsFailureResponse | {
  readonly ok: true;
  readonly deleted: number;
} | {
  readonly ok: false;
  readonly reason: 'confirm_required';
  readonly count?: number;
};

const allTurnsWindow = { startInclusive: '2000-01-01T00:00:00.000Z', endExclusive: '2100-01-01T00:00:00.000Z' };

export const onRequestDelete: PagesFunction<AdminEnv> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const stores = resolveStores(context.env);
    const sessionId = url.searchParams.get('sessionId');

    // 单条删除
    const id = url.searchParams.get('id');
    if (id) {
      const deleted = await stores.agentTurnStore.deleteTurnById(id, allTurnsWindow);
      return toJsonResponse({ ok: true, deleted } satisfies DeleteResponse);
    }

    if (sessionId) {
      const count = (await stores.agentTurnStore.listTurns(allTurnsWindow))
        .filter((turn) => turn.agentSessionId === sessionId)
        .length;
      if (count > 1 && url.searchParams.get('confirm') !== 'true') {
        return toJsonResponse({ ok: false, reason: 'confirm_required', count } satisfies DeleteResponse);
      }
      const deleted = await stores.agentTurnStore.deleteTurnsBySessionId(sessionId, allTurnsWindow);
      return toJsonResponse({ ok: true, deleted } satisfies DeleteResponse);
    }

    // 范围删除
    const rangeStart = url.searchParams.get('rangeStart');
    const rangeEnd = url.searchParams.get('rangeEnd');
    if (url.searchParams.has('rangeStart') !== url.searchParams.has('rangeEnd') || (url.searchParams.has('rangeStart') && (!rangeStart || !rangeEnd))) {
      throw new InvalidDateRangeError();
    }
    if (rangeStart && rangeEnd) {
      const { current } = getCustomWindow(rangeStart, rangeEnd);
      const deleted = await stores.agentTurnStore.deleteTurnsByRange(current);
      return toJsonResponse({ ok: true, deleted } satisfies DeleteResponse);
    }

    // 全清
    const all = url.searchParams.get('all');
    if (all === 'true') {
      const confirm = url.searchParams.get('confirm');
      if (confirm !== 'DELETE') {
        return toJsonResponse({ ok: false, reason: 'confirm_required' } satisfies DeleteResponse);
      }
      const deleted = await stores.agentTurnStore.deleteAllTurns();
      return toJsonResponse({ ok: true, deleted } satisfies DeleteResponse);
    }

    return toJsonResponse({ ok: false, reason: 'confirm_required' } satisfies DeleteResponse);
  } catch (error) {
    if (error instanceof InvalidDateRangeError) {
      return toJsonResponse({ ok: false, reason: 'invalid_date_range' }, 400);
    }
    if (error instanceof StoreUnavailableError) {
      return toJsonResponse({ ok: false, reason: 'db_unavailable' } satisfies DeleteResponse);
    }
    throw error;
  }
};
