/// <reference types="@cloudflare/workers-types" />

import { StoreUnavailableError } from '../../_store/errors';
import { getComparisonWindow, parseAdminStatsPeriod } from '../_period';
import { type StatsResponse, aggregateByKey, dbUnavailableResponse, getStoresSnapshot, okResponse } from './_shared';
import { type AdminEnv, toJsonResponse } from '../_shared';

type PagesStatsItem = {
  readonly path: string;
  readonly count: number;
};

type PagesStatsData = {
  readonly items: readonly PagesStatsItem[];
};

export const onRequestGet: PagesFunction<AdminEnv> = async (context) => {
  try {
    const period = parseAdminStatsPeriod(new URL(context.request.url).searchParams.get('period'));
    const { current } = getComparisonWindow(period);
    const snapshot = await getStoresSnapshot(context.env, current, current);
    const pageViews = snapshot.currentEvents
      .filter((event) => event.eventType === 'page_view' && typeof event.path === 'string')
      .map((event) => event.path as string);

    const data: PagesStatsData = {
      items: aggregateByKey(pageViews).map(({ key, count }) => ({ path: key, count })),
    };

    const response: StatsResponse<PagesStatsData> = okResponse(data);
    return toJsonResponse(response);
  } catch (error) {
    if (error instanceof StoreUnavailableError) {
      return toJsonResponse(dbUnavailableResponse());
    }
    throw error;
  }
};
