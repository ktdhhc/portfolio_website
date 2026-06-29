import { assertNever, formatComparisonCopy, formatMetricValue, getComparisonState, getRequiredElement, type AdminAuthFailureReason, type MetricKey } from './admin-dashboard-shared';

export function setLoginError(loginError: HTMLParagraphElement, reason: AdminAuthFailureReason | 'expired' | null): void {
  if (reason === null) {
    loginError.hidden = true;
    loginError.textContent = '';
    return;
  }

  loginError.hidden = false;
  switch (reason) {
    case 'invalid':
      loginError.textContent = 'Token 错误';
      return;
    case 'rate_limited':
      loginError.textContent = '尝试过于频繁，请稍后再试';
      return;
    case 'expired':
      loginError.textContent = '登录已失效，请重新输入 Token';
      return;
    default:
      assertNever(reason);
  }
}

export function showLogin(loginView: HTMLElement, dashboardView: HTMLElement): void {
  loginView.style.display = '';
  dashboardView.style.display = 'none';
}

export function showDashboard(loginView: HTMLElement, dashboardView: HTMLElement): void {
  loginView.style.display = 'none';
  dashboardView.style.display = '';
}

export function renderOverviewFailure(): void {
  const module = getRequiredElement<HTMLElement>(document, '[data-module="overview"]');
  getRequiredElement<HTMLElement>(module, '[data-module-unavailable]').hidden = false;
  getRequiredElement<HTMLElement>(module, '[data-overview-grid]').hidden = true;
}

export function renderOverviewSuccess(activePeriod: 'today' | 'week' | 'month', metrics: Record<MetricKey, { current: number; previous: number }>): void {
  const module = getRequiredElement<HTMLElement>(document, '[data-module="overview"]');
  getRequiredElement<HTMLElement>(module, '[data-module-unavailable]').hidden = true;
  getRequiredElement<HTMLElement>(module, '[data-overview-grid]').hidden = false;

  for (const key of Object.keys(metrics) as MetricKey[]) {
    const card = getRequiredElement<HTMLElement>(document, `[data-metric-card="${key}"]`);
    const metric = metrics[key];
    getRequiredElement<HTMLElement>(card, '.stat-value').textContent = formatMetricValue(key, metric.current);
    const change = getRequiredElement<HTMLElement>(card, '.stat-change');
    change.className = `stat-change ${getComparisonState(key, metric)}`;
    change.textContent = formatComparisonCopy(key, activePeriod, metric);
  }
}

export function renderModuleBody(key: 'pages' | 'projects' | 'agentSummary' | 'issues', degraded: boolean): void {
  const module = getRequiredElement<HTMLElement>(document, `[data-module="${key}"]`);
  getRequiredElement<HTMLElement>(module, '[data-module-body]').textContent = degraded ? '暂不可用' : '模块已连接，详情将在后续 issue 完成。';
}
