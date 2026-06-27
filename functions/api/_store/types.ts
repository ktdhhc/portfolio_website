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

export interface BehaviorEventStore {
  insertEvents(records: BehaviorEventRecord[]): Promise<void>;
}

export interface AgentTurnRecord {
  visitorUuid: string;
  agentSessionId: string;
  turnType: string;
  userMessage: string;
  assistantAnswer: string;
  answerStatus: string;
  durationMs: number;
  toolTrace?: Record<string, unknown>;
  createdAt: string;
}

export interface AgentTurnStore {
  insertTurn(record: AgentTurnRecord): Promise<void>;
}

export interface StoreEnv {
  BEHAVIOR_EVENT_STORE?: BehaviorEventStore;
  AGENT_TURN_STORE?: AgentTurnStore;
  RATE_LIMIT_STORE?: RateLimitStore;
  DB?: D1Database;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: 'uuid_limit' | 'global_limit';
}

export interface RateLimitStore {
  checkAndIncrement(visitorUuid: string): Promise<RateLimitResult>;
}
