/// <reference types="@cloudflare/workers-types" />

import { StoreUnavailableError } from '../../_store/errors';
import { type AdminEnv, toJsonResponse } from '../_shared';
import { InvalidDateRangeError, resolveWindow } from '../_period';
import { type StatsResponse, aggregateByKey, dbUnavailableResponse, getStoresSnapshot, okResponse } from './_shared';

type ProjectsStatsItem = {
  readonly targetId: string;
  readonly count: number;
};

type ProjectsStatsData = {
  readonly items: readonly ProjectsStatsItem[];
};

export const onRequestGet: PagesFunction<AdminEnv> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const { current } = resolveWindow(url);
    const snapshot = await getStoresSnapshot(context.env, current, current);
    const projectClicks = snapshot.currentEvents
      .filter((event) => event.eventType === 'project_click' && typeof event.targetId === 'string')
      .map((event) => event.targetId as string);

    const data: ProjectsStatsData = {
      items: aggregateByKey(projectClicks).map(({ key, count }) => ({ targetId: key, count })),
    };

    const response: StatsResponse<ProjectsStatsData> = okResponse(data);
    return toJsonResponse(response);
  } catch (error) {
    if (error instanceof InvalidDateRangeError) {
      return toJsonResponse({ ok: false, reason: 'invalid_date_range' }, 400);
    }
    if (error instanceof StoreUnavailableError) {
      return toJsonResponse(dbUnavailableResponse());
    }
    throw error;
  }
};
