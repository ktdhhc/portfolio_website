import type { Page } from '@playwright/test';

export type OverviewPayload = {
  readonly ok: true;
  readonly data: {
    readonly metrics: {
      readonly pageViews: { readonly current: number; readonly previous: number };
      readonly pdfDownloads: { readonly current: number; readonly previous: number };
      readonly agentTurns: { readonly current: number; readonly previous: number };
      readonly jdAnalyses: { readonly current: number; readonly previous: number };
      readonly avgPageDurationMs: { readonly current: number; readonly previous: number };
      readonly agentFailures: { readonly current: number; readonly previous: number };
    };
  };
};

export async function stubTrack(page: Page): Promise<void> {
  await page.route('**/api/track', async (route) => {
    await route.fulfill({ status: 200, body: '{}' });
  });
}

export async function stubNonOverviewStats(page: Page, options?: {
  readonly pages?: object;
  readonly projects?: object;
  readonly agentSummary?: object;
  readonly issues?: object;
}): Promise<void> {
  await page.route('**/api/admin/stats/pages**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options?.pages ?? { ok: true, data: { items: [] } }) });
  });
  await page.route('**/api/admin/stats/projects**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options?.projects ?? { ok: true, data: { items: [] } }) });
  });
  await page.route('**/api/admin/stats/agent-summary**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options?.agentSummary ?? { ok: true, data: { items: [] } }) });
  });
  await page.route('**/api/admin/stats/issues**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options?.issues ?? { ok: true, data: { items: [] } }) });
  });
}
