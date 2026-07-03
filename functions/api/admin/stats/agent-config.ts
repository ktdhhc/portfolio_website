/// <reference types="@cloudflare/workers-types" />

import { resolveAgentConfig, type ProviderEnv } from '../../_providers/index';
import { agentMaterials, readableAgentFileIds } from '../../_generated/agent-materials';
import type { AdminEnv } from '../_shared';
import { toJsonResponse } from '../_shared';
import { okResponse, type StatsResponse } from './_shared';

interface AgentConfigData {
  readonly runtime: {
    readonly provider: string;
    readonly model: string | null;
    readonly temperature: number | null;
    readonly effort: string | null;
    readonly toolLoopCap: number;
  };
  readonly startupContext: {
    readonly files: readonly string[];
  };
  readonly tools: readonly string[];
}

export const onRequestGet: PagesFunction<AdminEnv & ProviderEnv> = async (context) => {
  const config = resolveAgentConfig(context.env);

  const data: AgentConfigData = {
    runtime: {
      provider: config.provider,
      model: config.model,
      temperature: config.temperature,
      effort: config.effort,
      toolLoopCap: config.toolLoopCap,
    },
    startupContext: {
      files: [...readableAgentFileIds],
    },
    tools: ['read_file'],
  };

  const response: StatsResponse<AgentConfigData> = okResponse(data);
  return toJsonResponse(response);
};
