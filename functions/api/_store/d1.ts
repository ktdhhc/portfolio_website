import type { BehaviorEventStore, AgentTurnLogPage, AgentTurnStore, RateLimitStore, StoreEnv, BehaviorEventRecord, AgentTurnRecord, PeriodWindow, RateLimitResult, StoreWriteFailureRecord } from './types';
import { StoreUnavailableError } from './errors';

// D1 store 实现
// 生产环境通过 env.DB 注入 D1Database binding。
// 本地测试通过 node:sqlite 包装的 D1 兼容接口验证。

function hourBucket(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}`;
}

function dateBucket(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

type D1FailureState = {
  behaviorEventFailures: StoreWriteFailureRecord[];
  agentTurnFailures: StoreWriteFailureRecord[];
};

const d1FailureStates = new WeakMap<D1Database, D1FailureState>();

function getFailureState(db: D1Database): D1FailureState {
  const existing = d1FailureStates.get(db);
  if (existing) {
    return existing;
  }

  const created: D1FailureState = {
    behaviorEventFailures: [],
    agentTurnFailures: [],
  };
  d1FailureStates.set(db, created);
  return created;
}

function isWithinWindow(occurredAt: string, window: PeriodWindow): boolean {
  return occurredAt >= window.startInclusive && occurredAt < window.endExclusive;
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
  const failureState = getFailureState(db);

  return {
    async insertEvents(records: BehaviorEventRecord[]): Promise<void> {
      try {
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
      } catch (error) {
        failureState.behaviorEventFailures.push({ occurredAt: new Date().toISOString() });
        throw new StoreUnavailableError(undefined, { cause: error });
      }
    },

    async listEvents(window: PeriodWindow): Promise<readonly BehaviorEventRecord[]> {
      let result: { results: Array<Record<string, unknown>> };
      try {
        result = await db
          .prepare(
            `SELECT visitor_uuid, agent_session_id, event_type, path, target_kind, target_id, duration_ms, metadata_json, created_at
             FROM behavior_events
             WHERE created_at >= ? AND created_at < ?
             ORDER BY created_at ASC`,
          )
          .bind(window.startInclusive, window.endExclusive)
          .all() as { results: Array<Record<string, unknown>> };
      } catch (error) {
        throw new StoreUnavailableError(undefined, { cause: error });
      }

      return result.results.map((row) => ({
        visitorUuid: String(row.visitor_uuid),
        agentSessionId: typeof row.agent_session_id === 'string' ? row.agent_session_id : undefined,
        eventType: String(row.event_type),
        path: typeof row.path === 'string' ? row.path : undefined,
        targetKind: typeof row.target_kind === 'string' ? row.target_kind : undefined,
        targetId: typeof row.target_id === 'string' ? row.target_id : undefined,
        durationMs: typeof row.duration_ms === 'number' ? row.duration_ms : undefined,
        metadata: typeof row.metadata_json === 'string' ? JSON.parse(row.metadata_json) as Record<string, unknown> : undefined,
        createdAt: String(row.created_at),
      }));
    },

    async listWriteFailures(window: PeriodWindow): Promise<readonly StoreWriteFailureRecord[]> {
      return failureState.behaviorEventFailures.filter((record) => isWithinWindow(record.occurredAt, window));
    },
  };
}

function createD1AgentTurnStore(db: D1Database): AgentTurnStore {
  const failureState = getFailureState(db);

  function mapTurnRow(row: Record<string, unknown>): AgentTurnRecord {
    return {
      id: String(row.id),
      visitorUuid: String(row.visitor_uuid),
      agentSessionId: String(row.agent_session_id),
      turnType: String(row.turn_type),
      userMessage: String(row.user_message),
      assistantAnswer: String(row.assistant_answer),
      answerStatus: row.answer_status === 'degraded' || row.answer_status === 'failed' ? row.answer_status : 'success',
      durationMs: Number(row.duration_ms),
      toolTrace: typeof row.tool_trace_json === 'string' ? JSON.parse(row.tool_trace_json) as Record<string, unknown> : undefined,
      createdAt: String(row.created_at),
    };
  }

  return {
    async insertTurn(record: AgentTurnRecord): Promise<void> {
      try {
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
      } catch (error) {
        failureState.agentTurnFailures.push({ occurredAt: new Date().toISOString() });
        throw new StoreUnavailableError(undefined, { cause: error });
      }
    },

    async listTurns(window: PeriodWindow): Promise<readonly AgentTurnRecord[]> {
      let result: { results: Array<Record<string, unknown>> };
      try {
        result = await db
          .prepare(
            `SELECT id, visitor_uuid, agent_session_id, turn_type, user_message, assistant_answer, answer_status, duration_ms, tool_trace_json, created_at
             FROM agent_turns
             WHERE created_at >= ? AND created_at < ?
             ORDER BY created_at ASC`,
          )
          .bind(window.startInclusive, window.endExclusive)
          .all() as { results: Array<Record<string, unknown>> };
      } catch (error) {
        throw new StoreUnavailableError(undefined, { cause: error });
      }

      return result.results.map(mapTurnRow);
    },

    async listLogs(window: PeriodWindow, page: number, pageSize: number): Promise<AgentTurnLogPage> {
      try {
        const totalRow = await db
          .prepare(
            `SELECT COUNT(*) as total
             FROM agent_turns
             WHERE created_at >= ? AND created_at < ?`,
          )
          .bind(window.startInclusive, window.endExclusive)
          .first() as { total: number } | null;
        const total = Number(totalRow?.total ?? 0);
        const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);
        const offset = (page - 1) * pageSize;
        const result = await db
          .prepare(
            `SELECT id, visitor_uuid, agent_session_id, turn_type, user_message, assistant_answer, answer_status, duration_ms, tool_trace_json, created_at
             FROM agent_turns
             WHERE created_at >= ? AND created_at < ?
             ORDER BY created_at DESC, id DESC
             LIMIT ? OFFSET ?`,
          )
          .bind(window.startInclusive, window.endExclusive, pageSize, offset)
          .all() as { results: Array<Record<string, unknown>> };

        return {
          items: result.results.map(mapTurnRow),
          total,
          page,
          pageSize,
          totalPages,
        };
      } catch (error) {
        throw new StoreUnavailableError(undefined, { cause: error });
      }
    },

    async getLogDetail(id: string, window: PeriodWindow): Promise<AgentTurnRecord | null> {
      try {
        const row = await db
          .prepare(
            `SELECT id, visitor_uuid, agent_session_id, turn_type, user_message, assistant_answer, answer_status, duration_ms, tool_trace_json, created_at
             FROM agent_turns
             WHERE id = ? AND created_at >= ? AND created_at < ?`,
          )
          .bind(id, window.startInclusive, window.endExclusive)
          .first() as Record<string, unknown> | null;
        return row ? mapTurnRow(row) : null;
      } catch (error) {
        throw new StoreUnavailableError(undefined, { cause: error });
      }
    },

    async listWriteFailures(window: PeriodWindow): Promise<readonly StoreWriteFailureRecord[]> {
      return failureState.agentTurnFailures.filter((record) => isWithinWindow(record.occurredAt, window));
    },
  };
}

function createD1RateLimitStore(db: D1Database): RateLimitStore & {
  setUuidLimit(n: number): void;
  setGlobalLimit(n: number): void;
  setAdminFailureLimit(n: number): void;
  setAdminCooldownMs(ms: number): void;
} {
  let uuidLimit = 20;
  let globalLimit = 200;
  let adminFailureLimit = 5;
  let adminCooldownMs = 5 * 60 * 1000;

  return {
    setUuidLimit(n: number) { uuidLimit = n; },
    setGlobalLimit(n: number) { globalLimit = n; },
    setAdminFailureLimit(n: number) { adminFailureLimit = n; },
    setAdminCooldownMs(ms: number) { adminCooldownMs = ms; },

    async checkAndIncrement(visitorUuid: string): Promise<RateLimitResult> {
      try {
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
      } catch (error) {
        throw new StoreUnavailableError(undefined, { cause: error });
      }
    },

    async checkAdminLoginRateLimit(ip: string): Promise<RateLimitResult> {
      try {
        const nowMs = Date.now();
        const row = await db
          .prepare(
            `SELECT failure_count, cooldown_until_ms
             FROM admin_login_failures
             WHERE ip = ?`,
          )
          .bind(ip)
          .first() as { failure_count: number; cooldown_until_ms: number | null } | null;

        if (!row) {
          return { allowed: true };
        }

        if (typeof row.cooldown_until_ms === 'number' && row.cooldown_until_ms > nowMs) {
          return { allowed: false, reason: 'admin_rate_limit' };
        }

        if (typeof row.cooldown_until_ms === 'number' && row.cooldown_until_ms <= nowMs) {
          await db
            .prepare('DELETE FROM admin_login_failures WHERE ip = ?')
            .bind(ip)
            .run();
        }

        return { allowed: true };
      } catch (error) {
        throw new StoreUnavailableError(undefined, { cause: error });
      }
    },

    async recordAdminLoginFailure(ip: string): Promise<RateLimitResult> {
      try {
        const rateLimitResult = await this.checkAdminLoginRateLimit(ip);
        if (!rateLimitResult.allowed) {
          return rateLimitResult;
        }

        const row = await db
          .prepare(
            `SELECT failure_count
             FROM admin_login_failures
             WHERE ip = ?`,
          )
          .bind(ip)
          .first() as { failure_count: number } | null;

        const nextFailureCount = (row?.failure_count ?? 0) + 1;
        const nowIso = new Date().toISOString();
        const cooldownUntilMs = nextFailureCount >= adminFailureLimit ? Date.now() + adminCooldownMs : null;

        await db
          .prepare(
            `INSERT INTO admin_login_failures (ip, failure_count, cooldown_until_ms, updated_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(ip)
             DO UPDATE SET failure_count = excluded.failure_count,
                           cooldown_until_ms = excluded.cooldown_until_ms,
                           updated_at = excluded.updated_at`,
          )
          .bind(ip, nextFailureCount, cooldownUntilMs, nowIso)
          .run();

        if (cooldownUntilMs !== null) {
          return { allowed: false, reason: 'admin_rate_limit' };
        }

        return { allowed: true };
      } catch (error) {
        throw new StoreUnavailableError(undefined, { cause: error });
      }
    },

    async resetAdminLoginFailures(ip: string): Promise<void> {
      try {
        await db
          .prepare('DELETE FROM admin_login_failures WHERE ip = ?')
          .bind(ip)
          .run();
      } catch (error) {
        throw new StoreUnavailableError(undefined, { cause: error });
      }
    },
  };
}
