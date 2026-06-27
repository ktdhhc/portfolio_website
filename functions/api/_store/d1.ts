import type { BehaviorEventStore, AgentTurnStore, RateLimitStore, StoreEnv, BehaviorEventRecord, AgentTurnRecord, RateLimitResult } from './types';

// D1 store 实现
// 生产环境通过 env.DB 注入 D1Database binding。
// 本地测试通过 node:sqlite 包装的 D1 兼容接口验证。

function hourBucket(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
}

function dateBucket(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function createD1Stores(db: D1Database) {
  return {
    behaviorEventStore: createD1BehaviorEventStore(db),
    agentTurnStore: createD1AgentTurnStore(db),
    rateLimitStore: createD1RateLimitStore(db),
  };
}

// 从 StoreEnv 解析出实际使用的 stores
// 优先使用显式注入的 store（测试用），否则如果 env.DB 存在则用 D1 store，最后 fallback 到 fake
import { defaultBehaviorEventStore, defaultAgentTurnStore, defaultRateLimitStore } from './fake';

export function resolveStores(env: StoreEnv) {
  if (env.DB) {
    const d1Stores = createD1Stores(env.DB);
    return {
      behaviorEventStore: env.BEHAVIOR_EVENT_STORE ?? d1Stores.behaviorEventStore,
      agentTurnStore: env.AGENT_TURN_STORE ?? d1Stores.agentTurnStore,
      rateLimitStore: env.RATE_LIMIT_STORE ?? d1Stores.rateLimitStore,
    };
  }
  return {
    behaviorEventStore: env.BEHAVIOR_EVENT_STORE ?? defaultBehaviorEventStore,
    agentTurnStore: env.AGENT_TURN_STORE ?? defaultAgentTurnStore,
    rateLimitStore: env.RATE_LIMIT_STORE ?? defaultRateLimitStore,
  };
}

function createD1BehaviorEventStore(db: D1Database): BehaviorEventStore {
  return {
    async insertEvents(records: BehaviorEventRecord[]): Promise<void> {
      for (const record of records) {
        await db
          .prepare(
            `INSERT INTO behavior_events (visitor_uuid, agent_session_id, event_type, path, target_kind, target_id, duration_ms, metadata_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            record.visitorUuid,
            record.agentSessionId ?? null,
            record.eventType,
            record.path ?? null,
            record.targetKind ?? null,
            record.targetId ?? null,
            record.durationMs ?? null,
            record.metadata ? JSON.stringify(record.metadata) : null,
            record.createdAt,
          )
          .run();
      }
    },
  };
}

function createD1AgentTurnStore(db: D1Database): AgentTurnStore {
  return {
    async insertTurn(record: AgentTurnRecord): Promise<void> {
      await db
        .prepare(
          `INSERT INTO agent_turns (visitor_uuid, agent_session_id, turn_type, user_message, assistant_answer, answer_status, duration_ms, tool_trace_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          record.visitorUuid,
          record.agentSessionId,
          record.turnType,
          record.userMessage,
          record.assistantAnswer,
          record.answerStatus,
          record.durationMs,
          record.toolTrace ? JSON.stringify(record.toolTrace) : null,
          record.createdAt,
        )
        .run();
    },
  };
}

function createD1RateLimitStore(db: D1Database): RateLimitStore & {
  setUuidLimit(n: number): void;
  setGlobalLimit(n: number): void;
} {
  let uuidLimit = 20;
  let globalLimit = 200;

  return {
    setUuidLimit(n: number) { uuidLimit = n; },
    setGlobalLimit(n: number) { globalLimit = n; },

    async checkAndIncrement(visitorUuid: string): Promise<RateLimitResult> {
      const hb = hourBucket();
      const db_ = dateBucket();

      const row = await db
        .prepare(
          `SELECT uuid_count, date_bucket FROM rate_limit_counters WHERE visitor_uuid = ? AND hour_bucket = ?`,
        )
        .bind(visitorUuid, hb)
        .first() as { uuid_count: number; date_bucket: string } | null;

      const uuidCount = row?.uuid_count ?? 0;
      if (uuidCount >= uuidLimit) {
        return { allowed: false, reason: 'uuid_limit' };
      }

      // 全局计数：按 date_bucket 聚合
      const globalRow = await db
        .prepare(
          `SELECT COALESCE(SUM(uuid_count), 0) as total FROM rate_limit_counters WHERE date_bucket = ?`,
        )
        .bind(db_)
        .first() as { total: number } | null;

      const globalCount = globalRow?.total ?? 0;
      if (globalCount >= globalLimit) {
        return { allowed: false, reason: 'global_limit' };
      }

      await db
        .prepare(
          `INSERT INTO rate_limit_counters (visitor_uuid, hour_bucket, uuid_count, date_bucket)
           VALUES (?, ?, 1, ?)
           ON CONFLICT(visitor_uuid, hour_bucket)
           DO UPDATE SET uuid_count = uuid_count + 1`,
        )
        .bind(visitorUuid, hb, db_)
        .run();

      return { allowed: true };
    },
  };
}
