/// <reference types="@cloudflare/workers-types" />

import { StoreUnavailableError } from '../../_store/errors';
import { type AdminEnv, toJsonResponse } from '../_shared';
import { resolveWindow } from '../_period';
import { type ComparisonMetric, type StatsResponse, averageDuration, dbUnavailableResponse, getStoresSnapshot, okResponse } from './_shared';

type OverviewStatsData = {
  readonly metrics: {
    readonly pageViews: ComparisonMetric;
    readonly pdfDownloads: ComparisonMetric;
    readonly agentTurns: ComparisonMetric;
    readonly jdAnalyses: ComparisonMetric;
    readonly avgPageDurationMs: ComparisonMetric;
    readonly agentFailures: ComparisonMetric;
  };
};

function comparisonMetric(current: number, previous: number): ComparisonMetric {
  return { current, previous };
}

export const onRequestGet: PagesFunction<AdminEnv> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const { current, previous } = resolveWindow(url);
    const snapshot = await getStoresSnapshot(context.env, current, previous);

    const currentPageDurations = snapshot.currentEvents.filter((event) => event.eventType === 'page_duration' && typeof event.durationMs === 'number');
    const previousPageDurations = snapshot.previousEvents.filter((event) => event.eventType === 'page_duration' && typeof event.durationMs === 'number');

    const data: OverviewStatsData = {
      metrics: {
        pageViews: comparisonMetric(
          snapshot.currentEvents.filter((event) => event.eventType === 'page_view').length,
          snapshot.previousEvents.filter((event) => event.eventType === 'page_view').length,
        ),
        pdfDownloads: comparisonMetric(
          snapshot.currentEvents.filter((event) => event.eventType === 'pdf_download').length,
          snapshot.previousEvents.filter((event) => event.eventType === 'pdf_download').length,
        ),
        agentTurns: comparisonMetric(snapshot.currentTurns.length, snapshot.previousTurns.length),
        jdAnalyses: comparisonMetric(
          snapshot.currentTurns.filter((turn) => turn.turnType === 'jd_analysis').length,
          snapshot.previousTurns.filter((turn) => turn.turnType === 'jd_analysis').length,
        ),
        avgPageDurationMs: comparisonMetric(averageDuration(currentPageDurations), averageDuration(previousPageDurations)),
        agentFailures: comparisonMetric(
          snapshot.currentTurns.filter((turn) => turn.answerStatus !== 'success').length,
          snapshot.previousTurns.filter((turn) => turn.answerStatus !== 'success').length,
        ),
      },
    };

    const response: StatsResponse<OverviewStatsData> = okResponse(data);
    return toJsonResponse(response);
  } catch (error) {
    if (error instanceof StoreUnavailableError) {
      return toJsonResponse(dbUnavailableResponse());
    }
    throw error;
  }
};
