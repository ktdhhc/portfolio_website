import { assertNever, formatComparisonCopy, formatMetricValue, getComparisonState, getRequiredElement, type AdminAuthFailureReason, type MetricKey } from './admin-dashboard-shared';

type ModuleListKey = 'pages' | 'projects' | 'agentSummary' | 'issues';

export type ModuleListItemView = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly tone?: 'default' | 'danger';
};

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

export function renderModuleUnavailable(key: ModuleListKey): void {
  const module = getRequiredElement<HTMLElement>(document, `[data-module="${key}"]`);
  const unavailable = getRequiredElement<HTMLElement>(module, '[data-module-unavailable]');
  const empty = getRequiredElement<HTMLElement>(module, '[data-module-empty]');
  unavailable.hidden = false;
  unavailable.textContent = '暂不可用';
  empty.hidden = true;
  empty.textContent = '';
  const list = getRequiredElement<HTMLElement>(module, '[data-module-list]');
  list.hidden = true;
  list.replaceChildren();
}

export function renderModuleList(key: ModuleListKey, items: readonly ModuleListItemView[], emptyCopy = '暂无数据'): void {
  const module = getRequiredElement<HTMLElement>(document, `[data-module="${key}"]`);
  const unavailable = getRequiredElement<HTMLElement>(module, '[data-module-unavailable]');
  const empty = getRequiredElement<HTMLElement>(module, '[data-module-empty]');
  const list = getRequiredElement<HTMLUListElement>(module, '[data-module-list]');

  unavailable.hidden = true;
  unavailable.textContent = '';
  if (items.length === 0) {
    empty.hidden = false;
    empty.textContent = emptyCopy;
    list.hidden = true;
    list.replaceChildren();
    return;
  }

  empty.hidden = true;
  empty.textContent = '';
  list.hidden = false;
  list.replaceChildren(
    ...items.map((item) => {
      const row = document.createElement('li');
      row.className = `module-list-item${item.tone === 'danger' ? ' tone-danger' : ''}`;
      row.dataset.moduleItem = item.id;

      const label = document.createElement('span');
      label.className = 'module-list-label';
      label.textContent = item.label;

      const value = document.createElement('span');
      value.className = 'module-list-value';
      value.textContent = item.value;

      row.append(label, value);
      return row;
    }),
  );
}
