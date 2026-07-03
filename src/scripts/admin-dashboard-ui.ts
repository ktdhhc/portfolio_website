import { assertNever, formatComparisonCopy, formatMetricValue, getComparisonState, getRequiredElement, type AdminAuthFailureReason, type MetricKey } from './admin-dashboard-shared';

type ModuleListKey = 'pages' | 'projects' | 'agentSummary' | 'issues';

type RankedModuleKey = 'pages' | 'projects';
type CloudModuleKey = 'agentSummary';
type IssueModuleKey = 'issues';

export type ModuleListItemView = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly tone?: 'default' | 'danger';
};

export type RankedModuleItemView = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly rank: number;
  readonly ratio: number;
};

export type CloudModuleItemView = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
};

export type IssueModuleItemView = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly severity: 'warn' | 'error';
};

function getModuleRefs(key: ModuleListKey): {
  readonly module: HTMLElement;
  readonly unavailable: HTMLElement;
  readonly empty: HTMLElement;
  readonly list: HTMLUListElement;
} {
  const module = getRequiredElement<HTMLElement>(document, `[data-module="${key}"]`);
  return {
    module,
    unavailable: getRequiredElement<HTMLElement>(module, '[data-module-unavailable]'),
    empty: getRequiredElement<HTMLElement>(module, '[data-module-empty]'),
    list: getRequiredElement<HTMLUListElement>(module, '[data-module-list]'),
  };
}

function resetModuleListPresentation(list: HTMLUListElement): void {
  list.classList.remove('rank-list', 'cloud-list', 'issue-list');
  list.removeAttribute('data-rank-list');
  list.removeAttribute('data-cloud-list');
  list.removeAttribute('data-issue-list');
}

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
  const { unavailable, empty, list } = getModuleRefs(key);
  unavailable.hidden = false;
  unavailable.textContent = '暂不可用';
  empty.hidden = true;
  empty.textContent = '';
  list.hidden = true;
  resetModuleListPresentation(list);
  list.replaceChildren();
}

export function renderModuleList(key: ModuleListKey, items: readonly ModuleListItemView[], emptyCopy = '暂无数据'): void {
  const { unavailable, empty, list } = getModuleRefs(key);

  unavailable.hidden = true;
  unavailable.textContent = '';
  resetModuleListPresentation(list);
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

export function renderRankModuleList(key: RankedModuleKey, items: readonly RankedModuleItemView[], emptyCopy = '暂无数据'): void {
  const { unavailable, empty, list } = getModuleRefs(key);

  unavailable.hidden = true;
  unavailable.textContent = '';
  resetModuleListPresentation(list);
  list.classList.add('rank-list');
  list.setAttribute('data-rank-list', 'true');
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
      row.className = 'module-list-item rank-item';
      row.dataset.moduleItem = item.id;
      row.dataset.rankItem = String(item.rank);

      const rankNum = document.createElement('span');
      rankNum.className = `rank-num${item.rank <= 2 ? ' top' : ''}`;
      rankNum.textContent = String(item.rank);

      const rankInfo = document.createElement('div');
      rankInfo.className = 'rank-info';

      const rankName = document.createElement('div');
      rankName.className = 'rank-name';
      rankName.textContent = item.label;
      rankInfo.appendChild(rankName);

      const rankBar = document.createElement('div');
      rankBar.className = 'rank-bar';
      const rankBarFill = document.createElement('div');
      rankBarFill.className = 'rank-bar-fill';
      rankBarFill.style.width = `${Math.round(item.ratio * 100)}%`;
      rankBar.appendChild(rankBarFill);

      const rankValue = document.createElement('span');
      rankValue.className = 'rank-value';
      rankValue.textContent = item.value;

      row.append(rankNum, rankInfo, rankBar, rankValue);
      return row;
    }),
  );
}

export function renderTagCloudModule(key: CloudModuleKey, items: readonly CloudModuleItemView[], emptyCopy = '暂无数据'): void {
  const { unavailable, empty, list } = getModuleRefs(key);

  unavailable.hidden = true;
  unavailable.textContent = '';
  resetModuleListPresentation(list);
  list.classList.add('cloud-list');
  list.setAttribute('data-cloud-list', 'true');
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
      row.className = 'cloud-tag';
      row.dataset.moduleItem = item.id;
      row.dataset.cloudTag = item.id;

      const label = document.createElement('span');
      label.textContent = item.label;

      const value = document.createElement('span');
      value.className = 'cloud-tag-count';
      value.textContent = item.value;

      row.append(label, value);
      return row;
    }),
  );
}

export function renderIssueModuleList(key: IssueModuleKey, items: readonly IssueModuleItemView[], emptyCopy = '暂无数据'): void {
  const { unavailable, empty, list } = getModuleRefs(key);

  unavailable.hidden = true;
  unavailable.textContent = '';
  resetModuleListPresentation(list);
  list.classList.add('issue-list');
  list.setAttribute('data-issue-list', 'true');
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
      row.className = 'issue-item';
      row.dataset.moduleItem = item.id;
      row.dataset.issueItem = item.id;

      const dot = document.createElement('span');
      dot.className = `issue-dot ${item.severity}`;

      const content = document.createElement('div');
      content.className = 'issue-content';
      const title = document.createElement('div');
      title.className = 'issue-title';
      title.textContent = item.label;
      content.appendChild(title);

      const count = document.createElement('span');
      count.className = 'issue-count';
      count.textContent = item.value;

      row.append(dot, content, count);
      return row;
    }),
  );
}
