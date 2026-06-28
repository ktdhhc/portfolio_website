import { resolveStores } from '../../_store/d1';
import type { AgentTurnRecord, AgentTurnStore, BehaviorEventRecord, BehaviorEventStore, PeriodWindow, StoreWriteFailureRecord } from '../../_store/types';
import type { AdminEnv } from '../_shared';

export type StatsFailureResponse = {
  readonly ok: false;
  readonly reason: 'db_unavailable';
};

export type StatsSuccessResponse<T> = {
  readonly ok: true;
  readonly data: T;
};

export type StatsResponse<T> = StatsFailureResponse | StatsSuccessResponse<T>;

export type ComparisonMetric = {
  readonly current: number;
  readonly previous: number;
};

export type StoresSnapshot = {
  readonly currentEvents: readonly BehaviorEventRecord[];
  readonly previousEvents: readonly BehaviorEventRecord[];
  readonly currentTurns: readonly AgentTurnRecord[];
  readonly previousTurns: readonly AgentTurnRecord[];
  readonly currentBehaviorWriteFailures: readonly StoreWriteFailureRecord[];
  readonly currentTurnWriteFailures: readonly StoreWriteFailureRecord[];
};

export function okResponse<T>(data: T): StatsSuccessResponse<T> {
  return { ok: true, data };
}

export function dbUnavailableResponse(): StatsFailureResponse {
  return { ok: false, reason: 'db_unavailable' };
}

function sortByCountDesc<T extends { readonly count: number }>(items: readonly T[]): readonly T[] {
  return [...items].sort((left, right) => right.count - left.count || JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

export function aggregateByKey<T extends string>(
  values: readonly T[],
): ReadonlyArray<{ readonly key: T; readonly count: number }> {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return sortByCountDesc(
    Array.from(counts.entries()).map(([key, count]) => ({ key, count })),
  );
}

export function sumDurations(events: readonly BehaviorEventRecord[]): number {
  return events.reduce((sum, event) => sum + (event.durationMs ?? 0), 0);
}

export function averageDuration(events: readonly BehaviorEventRecord[]): number {
  if (events.length === 0) return 0;
  return Math.round(sumDurations(events) / events.length);
}

async function readEventWindow(store: BehaviorEventStore, window: PeriodWindow): Promise<readonly BehaviorEventRecord[]> {
  return store.listEvents(window);
}

async function readTurnWindow(store: AgentTurnStore, window: PeriodWindow): Promise<readonly AgentTurnRecord[]> {
  return store.listTurns(window);
}

export async function getStoresSnapshot(env: AdminEnv, currentWindow: PeriodWindow, previousWindow: PeriodWindow): Promise<StoresSnapshot> {
  const stores = resolveStores(env);

  return {
    currentEvents: await readEventWindow(stores.behaviorEventStore, currentWindow),
    previousEvents: await readEventWindow(stores.behaviorEventStore, previousWindow),
    currentTurns: await readTurnWindow(stores.agentTurnStore, currentWindow),
    previousTurns: await readTurnWindow(stores.agentTurnStore, previousWindow),
    currentBehaviorWriteFailures: await stores.behaviorEventStore.listWriteFailures(currentWindow),
    currentTurnWriteFailures: await stores.agentTurnStore.listWriteFailures(currentWindow),
  };
}
