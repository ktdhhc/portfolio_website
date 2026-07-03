const periodLabels = {
  today: '昨日',
  week: '上周',
  month: '上月',
} as const;

export const ADMIN_TOKEN_KEY = 'portfolio_admin_token';
export const moduleEndpoints = {
  overview: '/api/admin/stats/overview',
  agentConfig: '/api/admin/stats/agent-config',
  pages: '/api/admin/stats/pages',
  projects: '/api/admin/stats/projects',
  agentSummary: '/api/admin/stats/agent-summary',
  issues: '/api/admin/stats/issues',
  logs: '/api/admin/logs',
} as const;

export type AdminStatsPeriod = keyof typeof periodLabels;
export type AdminAuthFailureReason = 'invalid' | 'rate_limited';
export type ModuleKey = keyof typeof moduleEndpoints;
export type MetricKey = 'pageViews' | 'pdfDownloads' | 'agentTurns' | 'jdAnalyses' | 'avgPageDurationMs' | 'agentFailures';

export type AdminAuthResponse = { readonly ok: true } | { readonly ok: false; readonly reason: AdminAuthFailureReason };
export type StatsFailureResponse = { readonly ok: false; readonly reason: 'db_unavailable' };
export type ComparisonMetric = { readonly current: number; readonly previous: number };
export type OverviewResponse = StatsFailureResponse | {
  readonly ok: true;
  readonly data: {
    readonly metrics: Record<MetricKey, ComparisonMetric>;
  };
};

export type PagesStatsResponse = StatsFailureResponse | {
  readonly ok: true;
  readonly data: {
    readonly items: readonly {
      readonly path: string;
      readonly count: number;
    }[];
  };
};

export type ProjectsStatsResponse = StatsFailureResponse | {
  readonly ok: true;
  readonly data: {
    readonly items: readonly {
      readonly targetId: string;
      readonly count: number;
    }[];
  };
};

export type AgentSummaryStatsResponse = StatsFailureResponse | {
  readonly ok: true;
  readonly data: {
    readonly items: readonly {
      readonly keyword: string;
      readonly count: number;
    }[];
  };
};

export type IssuesStatsResponse = StatsFailureResponse | {
  readonly ok: true;
  readonly data: {
    readonly items: readonly {
      readonly kind: 'degraded' | 'failed' | 'd1_write_failure';
      readonly count: number;
    }[];
  };
};

export type LogsListItem = {
  readonly id: string;
  readonly visitorUuidShort: string;
  readonly agentSessionIdShort: string;
  readonly startedAt: string;
  readonly lastTurnAt: string;
  readonly turnCount: number;
  readonly latestUserMessage: string;
};

export type LogsDetailItem = {
  readonly id: string;
  readonly createdAt: string;
  readonly userMessage: string;
  readonly assistantAnswer: string;
  readonly turnType: string;
  readonly answerStatus: 'success' | 'degraded' | 'failed';
  readonly durationMs: number;
  readonly toolTraceSummary: {
    readonly toolCalls: number;
    readonly files: readonly string[];
  };
  readonly visitorUuidShort: string;
  readonly agentSessionIdShort: string;
};

export type LogsSessionDetail = {
  readonly id: string;
  readonly visitorUuidShort: string;
  readonly agentSessionIdShort: string;
  readonly startedAt: string;
  readonly lastTurnAt: string;
  readonly turnCount: number;
};

export type LogsSessionTurnItem = {
  readonly id: string;
  readonly createdAt: string;
  readonly userMessage: string;
  readonly turnType: string;
  readonly answerStatus: 'success' | 'degraded' | 'failed';
};

export type LogsListResponse = StatsFailureResponse | {
  readonly ok: true;
  readonly data: {
    readonly items: readonly LogsListItem[];
    readonly total: number;
    readonly page: number;
    readonly pageSize: number;
    readonly totalPages: number;
  };
};

export type LogsDetailResponse = StatsFailureResponse | {
  readonly ok: true;
  readonly data: {
    readonly item: LogsDetailItem | null;
  };
};

export type LogsSessionDetailResponse = StatsFailureResponse | {
  readonly ok: true;
  readonly data: {
    readonly session: LogsSessionDetail;
    readonly turns: readonly LogsSessionTurnItem[];
  };
};

export type AgentConfigResponse = StatsFailureResponse | {
  readonly ok: true;
  readonly data: {
    readonly runtime: {
      readonly provider: string;
      readonly model: string | null;
      readonly temperature: number | null;
      readonly effort: string | null;
      readonly toolLoopCap: number;
    };
    readonly startupContext: {
      readonly files: readonly string[];
    };
    readonly tools: readonly string[];
  };
};

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isAdminAuthResponse(value: unknown): value is AdminAuthResponse {
  if (!isRecord(value) || typeof value.ok !== 'boolean') return false;
  if (value.ok) return true;
  return value.reason === 'invalid' || value.reason === 'rate_limited';
}

export function isStatsFailureResponse(value: unknown): value is StatsFailureResponse {
  return isRecord(value) && value.ok === false && value.reason === 'db_unavailable';
}

function isComparisonMetric(value: unknown): value is ComparisonMetric {
  return isRecord(value) && typeof value.current === 'number' && typeof value.previous === 'number';
}

function isLogsListItem(value: unknown): value is LogsListItem {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.visitorUuidShort === 'string'
    && typeof value.agentSessionIdShort === 'string'
    && typeof value.startedAt === 'string'
    && typeof value.lastTurnAt === 'string'
    && typeof value.turnCount === 'number'
    && typeof value.latestUserMessage === 'string';
}

function isLogsSessionDetail(value: unknown): value is LogsSessionDetail {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.visitorUuidShort === 'string'
    && typeof value.agentSessionIdShort === 'string'
    && typeof value.startedAt === 'string'
    && typeof value.lastTurnAt === 'string'
    && typeof value.turnCount === 'number';
}

function isLogsSessionTurnItem(value: unknown): value is LogsSessionTurnItem {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.createdAt === 'string'
    && typeof value.userMessage === 'string'
    && typeof value.turnType === 'string'
    && (value.answerStatus === 'success' || value.answerStatus === 'degraded' || value.answerStatus === 'failed');
}

function isCountItemRecord(value: unknown, key: 'path' | 'targetId' | 'keyword' | 'kind'): value is Record<'count', number> & Record<typeof key, string> {
  return isRecord(value) && typeof value[key] === 'string' && typeof value.count === 'number';
}

function isLogsDetailItem(value: unknown): value is LogsDetailItem {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.createdAt === 'string'
    && typeof value.userMessage === 'string'
    && typeof value.assistantAnswer === 'string'
    && typeof value.turnType === 'string'
    && (value.answerStatus === 'success' || value.answerStatus === 'degraded' || value.answerStatus === 'failed')
    && typeof value.durationMs === 'number'
    && isRecord(value.toolTraceSummary)
    && typeof value.toolTraceSummary.toolCalls === 'number'
    && Array.isArray(value.toolTraceSummary.files)
    && value.toolTraceSummary.files.every((file) => typeof file === 'string')
    && typeof value.visitorUuidShort === 'string'
    && typeof value.agentSessionIdShort === 'string';
}

export function isOverviewResponse(value: unknown): value is OverviewResponse {
  if (isStatsFailureResponse(value)) return true;
  if (!isRecord(value) || value.ok !== true || !isRecord(value.data) || !isRecord(value.data.metrics)) return false;
  return ['pageViews', 'pdfDownloads', 'agentTurns', 'jdAnalyses', 'avgPageDurationMs', 'agentFailures']
    .every((key) => isComparisonMetric(value.data.metrics[key]));
}

export function isPagesStatsResponse(value: unknown): value is PagesStatsResponse {
  if (isStatsFailureResponse(value)) return true;
  return isRecord(value)
    && value.ok === true
    && isRecord(value.data)
    && Array.isArray(value.data.items)
    && value.data.items.every((item) => isCountItemRecord(item, 'path'));
}

export function isProjectsStatsResponse(value: unknown): value is ProjectsStatsResponse {
  if (isStatsFailureResponse(value)) return true;
  return isRecord(value)
    && value.ok === true
    && isRecord(value.data)
    && Array.isArray(value.data.items)
    && value.data.items.every((item) => isCountItemRecord(item, 'targetId'));
}

export function isAgentSummaryStatsResponse(value: unknown): value is AgentSummaryStatsResponse {
  if (isStatsFailureResponse(value)) return true;
  return isRecord(value)
    && value.ok === true
    && isRecord(value.data)
    && Array.isArray(value.data.items)
    && value.data.items.every((item) => isCountItemRecord(item, 'keyword'));
}

export function isIssuesStatsResponse(value: unknown): value is IssuesStatsResponse {
  if (isStatsFailureResponse(value)) return true;
  return isRecord(value)
    && value.ok === true
    && isRecord(value.data)
    && Array.isArray(value.data.items)
    && value.data.items.every((item) => isCountItemRecord(item, 'kind'))
    && value.data.items.every((item) => item.kind === 'degraded' || item.kind === 'failed' || item.kind === 'd1_write_failure');
}

export function isLogsListResponse(value: unknown): value is LogsListResponse {
  if (isStatsFailureResponse(value)) return true;
  return isRecord(value)
    && value.ok === true
    && isRecord(value.data)
    && Array.isArray(value.data.items)
    && value.data.items.every(isLogsListItem)
    && typeof value.data.total === 'number'
    && typeof value.data.page === 'number'
    && typeof value.data.pageSize === 'number'
    && typeof value.data.totalPages === 'number';
}

export function isLogsDetailResponse(value: unknown): value is LogsDetailResponse {
  if (isStatsFailureResponse(value)) return true;
  return isRecord(value)
    && value.ok === true
    && isRecord(value.data)
    && (value.data.item === null || isLogsDetailItem(value.data.item));
}

export function isLogsSessionDetailResponse(value: unknown): value is LogsSessionDetailResponse {
  if (isStatsFailureResponse(value)) return true;
  return isRecord(value)
    && value.ok === true
    && isRecord(value.data)
    && isLogsSessionDetail(value.data.session)
    && Array.isArray(value.data.turns)
    && value.data.turns.every(isLogsSessionTurnItem);
}

export function isAgentConfigResponse(value: unknown): value is AgentConfigResponse {
  if (isStatsFailureResponse(value)) return true;
  if (!isRecord(value) || value.ok !== true) return false;
  if (!isRecord(value.data)) return false;
  const { runtime, startupContext, tools } = value.data as Record<string, unknown>;
  return isRecord(runtime)
    && typeof runtime.provider === 'string'
    && (runtime.model === null || typeof runtime.model === 'string')
    && (runtime.temperature === null || typeof runtime.temperature === 'number')
    && (runtime.effort === null || typeof runtime.effort === 'string')
    && typeof runtime.toolLoopCap === 'number'
    && isRecord(startupContext)
    && Array.isArray(startupContext.files)
    && startupContext.files.every((f: unknown) => typeof f === 'string')
    && Array.isArray(tools)
    && tools.every((t: unknown) => typeof t === 'string');
}

export function getRequiredElement<T extends Element>(root: Document | Element, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

export function formatMetricValue(key: MetricKey, value: number): string {
  if (key !== 'avgPageDurationMs') return new Intl.NumberFormat('zh-CN').format(value);
  if (value <= 0) return '0s';
  const totalSeconds = Math.round(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function getComparisonState(key: MetricKey, metric: ComparisonMetric): 'up' | 'down' | 'neutral' {
  if (metric.current === metric.previous) return 'neutral';
  const isImprovement = key === 'agentFailures' ? metric.current < metric.previous : metric.current > metric.previous;
  return isImprovement ? 'up' : 'down';
}

export function formatComparisonCopy(key: MetricKey, period: AdminStatsPeriod, metric: ComparisonMetric): string {
  const label = periodLabels[period];
  const state = getComparisonState(key, metric);
  if (state === 'neutral') return `— 与${label}持平`;
  const delta = Math.abs(metric.current - metric.previous);
  const arrow = metric.current >= metric.previous ? '↑' : '↓';
  if (metric.previous <= 0) return `${arrow} ${delta} 较${label}`;
  return `${arrow} ${Math.round((delta / metric.previous) * 100)}% 较${label}`;
}
