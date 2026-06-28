/// <reference types="@cloudflare/workers-types" />

import { resolveStores } from '../_store/d1';
import { StoreUnavailableError } from '../_store/errors';
import type { AgentTurnRecord } from '../_store/types';
import { getComparisonWindow, parseAdminStatsPeriod } from './_period';
import { type AdminEnv, toJsonResponse } from './_shared';

type LogsFailureResponse = {
  readonly ok: false;
  readonly reason: 'db_unavailable';
};

type LogsListItem = {
  readonly id: string;
  readonly createdAt: string;
  readonly userMessage: string;
  readonly turnType: string;
  readonly answerStatus: AgentTurnRecord['answerStatus'];
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

function toListItem(record: AgentTurnRecord): LogsListItem {
  return {
    id: record.id ?? '',
    createdAt: record.createdAt,
    userMessage: record.userMessage.length <= 80 ? record.userMessage : record.userMessage.slice(0, 80),
    turnType: record.turnType,
    answerStatus: record.answerStatus,
  };
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

function dbUnavailableResponse(): LogsFailureResponse {
  return { ok: false, reason: 'db_unavailable' };
}

export const onRequestGet: PagesFunction<AdminEnv> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const period = parseAdminStatsPeriod(url.searchParams.get('period'));
    const { current } = getComparisonWindow(period);
    const stores = resolveStores(context.env);
    const logId = url.searchParams.get('id');

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
    const result = await stores.agentTurnStore.listLogs(current, page, pageSize);
    const response: LogsResponse = {
      ok: true,
      data: {
        items: result.items.map(toListItem),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    };
    return toJsonResponse(response);
  } catch (error) {
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
};

export const onRequestDelete: PagesFunction<AdminEnv> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const stores = resolveStores(context.env);

    // 单条删除
    const id = url.searchParams.get('id');
    if (id) {
      const window = { startInclusive: '2000-01-01T00:00:00.000Z', endExclusive: '2100-01-01T00:00:00.000Z' };
      const deleted = await stores.agentTurnStore.deleteTurnById(id, window);
      return toJsonResponse({ ok: true, deleted } satisfies DeleteResponse);
    }

    // 范围删除
    const rangeStart = url.searchParams.get('rangeStart');
    const rangeEnd = url.searchParams.get('rangeEnd');
    if (rangeStart && rangeEnd) {
      const window = { startInclusive: rangeStart, endExclusive: rangeEnd };
      const deleted = await stores.agentTurnStore.deleteTurnsByRange(window);
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
    if (error instanceof StoreUnavailableError) {
      return toJsonResponse({ ok: false, reason: 'db_unavailable' } satisfies DeleteResponse);
    }
    throw error;
  }
};
