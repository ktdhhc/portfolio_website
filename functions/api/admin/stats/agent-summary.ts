/// <reference types="@cloudflare/workers-types" />

import { StoreUnavailableError } from '../../_store/errors';
import { type AdminEnv, toJsonResponse } from '../_shared';
import { InvalidDateRangeError, resolveWindow } from '../_period';
import { type StatsResponse, dbUnavailableResponse, okResponse } from './_shared';
import { resolveStores } from '../../_store/d1';

const keywordMatchers = [
  { keyword: 'Aindexer', matchers: ['aindexer'] },
  { keyword: '项目经验', matchers: ['项目经验', '项目经历'] },
  { keyword: '岗位匹配', matchers: ['岗位匹配', '匹配度', '匹配'] },
  { keyword: '技术栈', matchers: ['技术栈', '技术'] },
  { keyword: '自我介绍', matchers: ['自我介绍'] },
  { keyword: 'JD 分析', matchers: ['jd', '岗位描述'] },
  { keyword: '工作方式', matchers: ['工作方式'] },
  { keyword: '教育背景', matchers: ['教育背景', '教育经历'] },
  { keyword: 'Agent', matchers: ['agent'] },
] as const;

type AgentSummaryItem = {
  readonly keyword: string;
  readonly count: number;
};

type AgentSummaryData = {
  readonly items: readonly AgentSummaryItem[];
};

export const onRequestGet: PagesFunction<AdminEnv> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const { current } = resolveWindow(url);
    const stores = resolveStores(context.env);
    const turns = await stores.agentTurnStore.listTurns(current);
    const counts = new Map<string, number>();

    for (const turn of turns) {
      const normalized = turn.userMessage.toLowerCase();
      for (const matcher of keywordMatchers) {
        if (matcher.matchers.some((value) => normalized.includes(value.toLowerCase()))) {
          counts.set(matcher.keyword, (counts.get(matcher.keyword) ?? 0) + 1);
        }
      }
    }

    const data: AgentSummaryData = {
      items: Array.from(counts.entries())
        .map(([keyword, count]) => ({ keyword, count }))
        .sort((left, right) => right.count - left.count || left.keyword.localeCompare(right.keyword)),
    };

    const response: StatsResponse<AgentSummaryData> = okResponse(data);
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
