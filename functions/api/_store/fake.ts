import type { BehaviorEventStore, BehaviorEventRecord, AgentTurnLogPage, AgentTurnStore, AgentTurnRecord, PeriodWindow, RateLimitStore, RateLimitResult, StoreWriteFailureRecord } from './types';
import { StoreUnavailableError } from './errors';

// 本地开发和测试用的内存存储。
// 生产环境使用 D1 实现，由 env 注入。

export class FakeBehaviorEventStore implements BehaviorEventStore {
  records: BehaviorEventRecord[] = [];
  writeFailures: StoreWriteFailureRecord[] = [];
  shouldFailList = false;

  async insertEvents(records: BehaviorEventRecord[]): Promise<void> {
    this.records.push(...records);
  }

  async listEvents(window: PeriodWindow): Promise<readonly BehaviorEventRecord[]> {
    if (this.shouldFailList) throw new StoreUnavailableError();
    return this.records.filter((record) => record.createdAt >= window.startInclusive && record.createdAt < window.endExclusive);
  }

  async listWriteFailures(window: PeriodWindow): Promise<readonly StoreWriteFailureRecord[]> {
    return this.writeFailures.filter((record) => record.occurredAt >= window.startInclusive && record.occurredAt < window.endExclusive);
  }
}

export class FakeAgentTurnStore implements AgentTurnStore {
  records: AgentTurnRecord[] = [];
  writeFailures: StoreWriteFailureRecord[] = [];
  shouldFailDelete = false;
  shouldFailList = false;

  private withIds(): readonly AgentTurnRecord[] {
    return this.records.map((record, index) => ({
      ...record,
      id: record.id ?? String(index + 1),
    }));
  }

  private inWindow(window: PeriodWindow): readonly AgentTurnRecord[] {
    return this.withIds().filter((record) => record.createdAt >= window.startInclusive && record.createdAt < window.endExclusive);
  }

  async insertTurn(record: AgentTurnRecord): Promise<void> {
    this.records.push({
      ...record,
      id: record.id ?? String(this.records.length + 1),
    });
  }

  async listTurns(window: PeriodWindow): Promise<readonly AgentTurnRecord[]> {
    if (this.shouldFailList) throw new StoreUnavailableError();
    return this.inWindow(window);
  }

  async listLogs(window: PeriodWindow, page: number, pageSize: number): Promise<AgentTurnLogPage> {
    const sorted = [...this.inWindow(window)].sort((left, right) => right.createdAt.localeCompare(left.createdAt) || Number(right.id) - Number(left.id));
    const total = sorted.length;
    const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;

    return {
      items: sorted.slice(start, start + pageSize),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async getLogDetail(id: string, window: PeriodWindow): Promise<AgentTurnRecord | null> {
    return this.inWindow(window).find((record) => record.id === id) ?? null;
  }

  async listWriteFailures(window: PeriodWindow): Promise<readonly StoreWriteFailureRecord[]> {
    return this.writeFailures.filter((record) => record.occurredAt >= window.startInclusive && record.occurredAt < window.endExclusive);
  }

  async deleteTurnById(id: string, window: PeriodWindow): Promise<number> {
    if (this.shouldFailDelete) throw new StoreUnavailableError();
    const index = this.records.findIndex((record) => {
      const recordId = record.id ?? String(this.records.indexOf(record) + 1);
      return recordId === id && record.createdAt >= window.startInclusive && record.createdAt < window.endExclusive;
    });
    if (index === -1) return 0;
    this.records.splice(index, 1);
    return 1;
  }

  async deleteTurnsBySessionId(sessionId: string, window: PeriodWindow): Promise<number> {
    if (this.shouldFailDelete) throw new StoreUnavailableError();
    const before = this.records.length;
    this.records = this.records.filter((record) => record.agentSessionId !== sessionId || record.createdAt < window.startInclusive || record.createdAt >= window.endExclusive);
    return before - this.records.length;
  }

  async deleteTurnsByRange(window: PeriodWindow): Promise<number> {
    if (this.shouldFailDelete) throw new StoreUnavailableError();
    const before = this.records.length;
    this.records = this.records.filter((record) => record.createdAt < window.startInclusive || record.createdAt >= window.endExclusive);
    return before - this.records.length;
  }

  async deleteAllTurns(): Promise<number> {
    if (this.shouldFailDelete) throw new StoreUnavailableError();
    const count = this.records.length;
    this.records = [];
    return count;
  }
}

export class FakeRateLimitStore implements RateLimitStore {
  uuidCounts: Map<string, number> = new Map();
  uuidHourBuckets: Map<string, string> = new Map();
  globalCount: number = 0;
  globalDateBucket: string = '';
  uuidLimit: number = 20;
  globalLimit: number = 200;
  adminFailureCounts: Map<string, number> = new Map();
  adminCooldownUntil: Map<string, number> = new Map();
  adminFailureLimit: number = 5;
  adminCooldownMs: number = 5 * 60 * 1000;
  shouldFail: boolean = false;
  private nowOffset: number = 0;

  advanceTime(ms: number): void {
    this.nowOffset += ms;
  }

  private currentHourBucket(): string {
    const d = new Date(Date.now() + this.nowOffset);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}`;
  }

  private currentDateBucket(): string {
    const d = new Date(Date.now() + this.nowOffset);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  private currentNowMs(): number {
    return Date.now() + this.nowOffset;
  }

  private clearExpiredAdminCooldown(ip: string): void {
    const cooldownUntil = this.adminCooldownUntil.get(ip);
    if (cooldownUntil === undefined) return;
    if (cooldownUntil > this.currentNowMs()) return;
    this.adminCooldownUntil.delete(ip);
    this.adminFailureCounts.delete(ip);
  }

  async checkAndIncrement(visitorUuid: string): Promise<RateLimitResult> {
    if (this.shouldFail) throw new StoreUnavailableError();

    const hourBucket = this.currentHourBucket();
    const dateBucket = this.currentDateBucket();

    const storedHour = this.uuidHourBuckets.get(visitorUuid);
    if (storedHour !== hourBucket) {
      this.uuidCounts.set(visitorUuid, 0);
      this.uuidHourBuckets.set(visitorUuid, hourBucket);
    }

    if (this.globalDateBucket !== dateBucket) {
      this.globalCount = 0;
      this.globalDateBucket = dateBucket;
    }

    const uuidCount = this.uuidCounts.get(visitorUuid) ?? 0;
    if (uuidCount >= this.uuidLimit) {
      return { allowed: false, reason: 'uuid_limit' };
    }
    if (this.globalCount >= this.globalLimit) {
      return { allowed: false, reason: 'global_limit' };
    }

    this.uuidCounts.set(visitorUuid, uuidCount + 1);
    this.globalCount += 1;
    return { allowed: true };
  }

  async checkAdminLoginRateLimit(ip: string): Promise<RateLimitResult> {
    if (this.shouldFail) throw new StoreUnavailableError();

    this.clearExpiredAdminCooldown(ip);

    const cooldownUntil = this.adminCooldownUntil.get(ip);
    if (cooldownUntil !== undefined && cooldownUntil > this.currentNowMs()) {
      return { allowed: false, reason: 'admin_rate_limit' };
    }

    return { allowed: true };
  }

  async recordAdminLoginFailure(ip: string): Promise<RateLimitResult> {
    if (this.shouldFail) throw new StoreUnavailableError();

    const rateLimitResult = await this.checkAdminLoginRateLimit(ip);
    if (!rateLimitResult.allowed) return rateLimitResult;

    const nextFailureCount = (this.adminFailureCounts.get(ip) ?? 0) + 1;
    this.adminFailureCounts.set(ip, nextFailureCount);

    if (nextFailureCount >= this.adminFailureLimit) {
      this.adminCooldownUntil.set(ip, this.currentNowMs() + this.adminCooldownMs);
      return { allowed: false, reason: 'admin_rate_limit' };
    }

    return { allowed: true };
  }

  async resetAdminLoginFailures(ip: string): Promise<void> {
    if (this.shouldFail) throw new StoreUnavailableError();

    this.adminFailureCounts.delete(ip);
    this.adminCooldownUntil.delete(ip);
  }
}

// 模块级默认 fake 实例，用于本地开发无注入时。
export const defaultBehaviorEventStore = new FakeBehaviorEventStore();
export const defaultAgentTurnStore = new FakeAgentTurnStore();
export const defaultRateLimitStore = new FakeRateLimitStore();
