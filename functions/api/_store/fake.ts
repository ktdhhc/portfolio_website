import type { BehaviorEventStore, BehaviorEventRecord, AgentTurnStore, AgentTurnRecord, RateLimitStore, RateLimitResult } from './types';

// 本地开发和测试用的内存存储。
// 生产环境使用 D1 实现，由 env 注入。

export class FakeBehaviorEventStore implements BehaviorEventStore {
  records: BehaviorEventRecord[] = [];

  async insertEvents(records: BehaviorEventRecord[]): Promise<void> {
    this.records.push(...records);
  }
}

export class FakeAgentTurnStore implements AgentTurnStore {
  records: AgentTurnRecord[] = [];

  async insertTurn(record: AgentTurnRecord): Promise<void> {
    this.records.push(record);
  }
}

export class FakeRateLimitStore implements RateLimitStore {
  uuidCounts: Map<string, number> = new Map();
  uuidHourBuckets: Map<string, string> = new Map();
  globalCount: number = 0;
  globalDateBucket: string = '';
  uuidLimit: number = 20;
  globalLimit: number = 200;
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

  async checkAndIncrement(visitorUuid: string): Promise<RateLimitResult> {
    if (this.shouldFail) throw new Error('D1 unavailable');

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
}

// 模块级默认 fake 实例，用于本地开发无注入时。
export const defaultBehaviorEventStore = new FakeBehaviorEventStore();
export const defaultAgentTurnStore = new FakeAgentTurnStore();
export const defaultRateLimitStore = new FakeRateLimitStore();
