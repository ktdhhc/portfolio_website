/// <reference types="@cloudflare/workers-types" />

import { StoreUnavailableError } from '../../_store/errors';
import { type AdminEnv, toJsonResponse } from '../_shared';
import { resolveWindow } from '../_period';
import { type StatsResponse, dbUnavailableResponse, getStoresSnapshot, okResponse } from './_shared';

type IssuesItem = {
  readonly kind: 'degraded' | 'failed' | 'd1_write_failure';
  readonly count: number;
};

type IssuesData = {
  readonly items: readonly IssuesItem[];
};

export const onRequestGet: PagesFunction<AdminEnv> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const { current } = resolveWindow(url);
    const snapshot = await getStoresSnapshot(context.env, current, current);

    const degradedCount = snapshot.currentTurns.filter((turn) => turn.answerStatus === 'degraded').length;
    const failedCount = snapshot.currentTurns.filter((turn) => turn.answerStatus === 'failed').length;
    const d1WriteFailureCount = snapshot.currentBehaviorWriteFailures.length + snapshot.currentTurnWriteFailures.length;

    const data: IssuesData = {
      items: [
        { kind: 'degraded', count: degradedCount },
        { kind: 'failed', count: failedCount },
        { kind: 'd1_write_failure', count: d1WriteFailureCount },
      ],
    };

    const response: StatsResponse<IssuesData> = okResponse(data);
    return toJsonResponse(response);
  } catch (error) {
    if (error instanceof StoreUnavailableError) {
      return toJsonResponse(dbUnavailableResponse());
    }
    throw error;
  }
};
