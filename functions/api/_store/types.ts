// 行为事件存储抽象
// fake 实现用于本地开发和测试；D1 实现用于生产。

export interface BehaviorEventRecord {
  visitorUuid: string;
  agentSessionId?: string;
  eventType: string;
  path?: string;
  targetKind?: string;
  targetId?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type PeriodWindow = {
  readonly startInclusive: string;
  readonly endExclusive: string;
};

export type StoreWriteFailureRecord = {
  readonly occurredAt: string;
};

export interface BehaviorEventStore {
  insertEvents(records: BehaviorEventRecord[]): Promise<void>;
  listEvents(window: PeriodWindow): Promise<readonly BehaviorEventRecord[]>;
  listWriteFailures(window: PeriodWindow): Promise<readonly StoreWriteFailureRecord[]>;
}

export type AgentTurnStatus = 'success' | 'degraded' | 'failed';

export interface AgentTurnRecord {
  id?: string;
  visitorUuid: string;
  agentSessionId: string;
  turnType: string;
  userMessage: string;
  assistantAnswer: string;
  answerStatus: AgentTurnStatus;
  durationMs: number;
  toolTrace?: Record<string, unknown>;
  createdAt: string;
}

export type AgentTurnLogPage = {
  readonly items: readonly AgentTurnRecord[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
};

export interface AgentTurnStore {
  insertTurn(record: AgentTurnRecord): Promise<void>;
  listTurns(window: PeriodWindow): Promise<readonly AgentTurnRecord[]>;
  listLogs(window: PeriodWindow, page: number, pageSize: number): Promise<AgentTurnLogPage>;
  getLogDetail(id: string, window: PeriodWindow): Promise<AgentTurnRecord | null>;
  listWriteFailures(window: PeriodWindow): Promise<readonly StoreWriteFailureRecord[]>;
}

export interface StoreEnv {
  BEHAVIOR_EVENT_STORE?: BehaviorEventStore;
  AGENT_TURN_STORE?: AgentTurnStore;
  RATE_LIMIT_STORE?: RateLimitStore;
  DB?: D1Database;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: 'uuid_limit' | 'global_limit' | 'admin_rate_limit';
}

export interface RateLimitStore {
  checkAndIncrement(visitorUuid: string): Promise<RateLimitResult>;
  checkAdminLoginRateLimit(ip: string): Promise<RateLimitResult>;
  recordAdminLoginFailure(ip: string): Promise<RateLimitResult>;
  resetAdminLoginFailures(ip: string): Promise<void>;
}
