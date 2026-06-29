/// <reference types="@cloudflare/workers-types" />

import { resolveStores } from '../_store/d1';
import { StoreUnavailableError } from '../_store/errors';
import type { AgentTurnRecord } from '../_store/types';
import { resolveWindow } from './_period';
import { type AdminEnv, toJsonResponse } from './_shared';

type ExportFailureResponse = {
  readonly ok: false;
  readonly reason: 'db_unavailable';
};

type ExportItem = {
  readonly id: string;
  readonly createdAt: string;
  readonly turnType: string;
  readonly answerStatus: string;
  readonly userMessage: string;
  readonly assistantAnswer: string;
  readonly durationMs: number;
  readonly visitorUuidShort: string;
  readonly agentSessionIdShort: string;
  readonly toolTraceJson: string;
};

function toExportItem(record: AgentTurnRecord): ExportItem {
  return {
    id: record.id ?? '',
    createdAt: record.createdAt,
    turnType: record.turnType,
    answerStatus: record.answerStatus,
    userMessage: record.userMessage,
    assistantAnswer: record.assistantAnswer,
    durationMs: record.durationMs,
    visitorUuidShort: record.visitorUuid.slice(0, 8),
    agentSessionIdShort: record.agentSessionId.slice(0, 8),
    toolTraceJson: record.toolTrace ? JSON.stringify(record.toolTrace) : '',
  };
}

// RFC 4180 CSV 转义：含逗号/引号/换行的字段用双引号包裹，内部引号加倍
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvRow(item: ExportItem): string {
  return [
    escapeCsvField(item.id),
    escapeCsvField(item.createdAt),
    escapeCsvField(item.turnType),
    escapeCsvField(item.answerStatus),
    escapeCsvField(item.userMessage),
    escapeCsvField(item.assistantAnswer),
    String(item.durationMs),
    escapeCsvField(item.visitorUuidShort),
    escapeCsvField(item.agentSessionIdShort),
    escapeCsvField(item.toolTraceJson),
  ].join(',');
}

const CSV_HEADER = 'id,created_at,turn_type,answer_status,user_message,assistant_answer,duration_ms,visitor_uuid_short,agent_session_id_short,tool_trace_json';

function dbUnavailableResponse(): ExportFailureResponse {
  return { ok: false, reason: 'db_unavailable' };
}

export const onRequestGet: PagesFunction<AdminEnv> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const format = url.searchParams.get('format') ?? 'json';
    const periodParam = url.searchParams.get('period') ?? 'all';

    const stores = resolveStores(context.env);

    let records: readonly AgentTurnRecord[];
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    if (startDate && endDate) {
      const { current } = resolveWindow(url);
      records = await stores.agentTurnStore.listTurns(current);
    } else if (periodParam === 'all') {
      // 全量：用一个极大窗口
      records = await stores.agentTurnStore.listTurns({
        startInclusive: '2000-01-01T00:00:00.000Z',
        endExclusive: '2100-01-01T00:00:00.000Z',
      });
    } else {
      const { current } = resolveWindow(url);
      records = await stores.agentTurnStore.listTurns(current);
    }

    const items = records.map(toExportItem);

    if (format === 'csv') {
      const csvLines = [CSV_HEADER, ...items.map(toCsvRow)];
      const csv = csvLines.join('\n');
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="agent-logs.csv"',
        },
      });
    }

    // JSON 格式
    return new Response(JSON.stringify(items), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="agent-logs.json"',
      },
    });
  } catch (error) {
    if (error instanceof StoreUnavailableError) {
      return toJsonResponse(dbUnavailableResponse());
    }
    throw error;
  }
};
