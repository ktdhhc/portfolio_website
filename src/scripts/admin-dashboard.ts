import {
  ADMIN_TOKEN_KEY,
  assertNever,
  formatComparisonCopy,
  formatMetricValue,
  getComparisonState,
  getRequiredElement,
  isAgentSummaryStatsResponse,
  isAdminAuthResponse,
  isIssuesStatsResponse,
  isLogsDetailResponse,
  isLogsListResponse,
  isOverviewResponse,
  isPagesStatsResponse,
  isProjectsStatsResponse,
  isStatsFailureResponse,
  moduleEndpoints,
  type AdminAuthFailureReason,
  type AdminStatsPeriod,
  type LogsDetailItem,
  type LogsListItem,
  type MetricKey,
  type ModuleKey,
} from './admin-dashboard-shared';
import { deleteLogs, exportLogs, fetchAdminJson } from './admin-dashboard-http';
import {
  getLogsRefs,
  renderLogDetail as renderLogsPanelDetail,
  renderLogsList as renderLogsPanelList,
  renderLogsUnavailable as renderLogsPanelUnavailable,
  syncLogsButtons,
} from './admin-dashboard-logs';
import { renderModuleList, renderModuleUnavailable } from './admin-dashboard-ui';

export function initAdminDashboard(): void {
  const setup = () => {
    const loginView = getRequiredElement<HTMLElement>(document, '[data-view="login"]');
    const dashboardView = getRequiredElement<HTMLElement>(document, '[data-view="dashboard"]');
    const loginButton = getRequiredElement<HTMLButtonElement>(document, '#loginButton');
    const logoutButton = getRequiredElement<HTMLButtonElement>(document, '#logoutButton');
    const tokenInput = getRequiredElement<HTMLInputElement>(document, '#adminToken');
    const loginError = getRequiredElement<HTMLParagraphElement>(document, '[data-login-error]');
    const periodButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-period]'));
    const logsPrevButton = getRequiredElement<HTMLButtonElement>(document, '[data-logs-prev]');
    const logsNextButton = getRequiredElement<HTMLButtonElement>(document, '[data-logs-next]');
    const logsRefs = getLogsRefs();
    const exportAllInput = getRequiredElement<HTMLInputElement>(document, '[data-export-all]');
    const customRangeContainer = getRequiredElement<HTMLElement>(document, '[data-custom-range]');
    const startDateInput = getRequiredElement<HTMLInputElement>(document, '#startDate');
    const endDateInput = getRequiredElement<HTMLInputElement>(document, '#endDate');
    let activePeriod: AdminStatsPeriod = 'week';
    let activeToken = '';
    let isBusy = false;
    let activeLogsPage = 1;
    let activeLogDetailId: string | null = null;
    let logsTotalPages = 1;
    let isCustomMode = false;
    let customDates: { start: string; end: string } | undefined;

    const setLoginError = (reason: AdminAuthFailureReason | 'expired' | null): void => {
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
    };

    const syncPagerButtons = (): void => {
      syncLogsButtons(logsRefs, {
        isBusy,
        page: activeLogsPage,
        totalPages: logsTotalPages,
      });
    };

    const setBusy = (nextBusy: boolean): void => {
      isBusy = nextBusy;
      loginButton.disabled = nextBusy;
      periodButtons.forEach((button) => {
        button.disabled = nextBusy;
      });
      syncPagerButtons();
    };

    const showLogin = (): void => {
      loginView.style.display = '';
      dashboardView.style.display = 'none';
    };

    const showDashboard = (): void => {
      loginView.style.display = 'none';
      dashboardView.style.display = '';
    };

    const updatePeriodButtons = (period: AdminStatsPeriod): void => {
      periodButtons.forEach((button) => {
        if (button.dataset.period === 'custom') {
          button.classList.toggle('active', isCustomMode);
        } else {
          button.classList.toggle('active', !isCustomMode && button.dataset.period === period);
        }
      });
    };

    const showCustomRange = (): void => {
      customRangeContainer.classList.remove('hidden');
    };

    const hideCustomRange = (): void => {
      customRangeContainer.classList.add('hidden');
      startDateInput.value = '';
      endDateInput.value = '';
      customDates = undefined;
      isCustomMode = false;
    };

    const customRangeError = getRequiredElement<HTMLParagraphElement>(document, '[data-custom-range-error]');

    const setCustomRangeError = (message: string | null): void => {
      if (message === null) {
        customRangeError.hidden = true;
        customRangeError.textContent = '';
        startDateInput.removeAttribute('aria-invalid');
        endDateInput.removeAttribute('aria-invalid');
        return;
      }
      customRangeError.hidden = false;
      customRangeError.textContent = message;
      startDateInput.setAttribute('aria-invalid', 'true');
      endDateInput.setAttribute('aria-invalid', 'true');
    };

    const applyCustomDates = (): void => {
      const start = startDateInput.value;
      const end = endDateInput.value;
      if (!start || !end) {
        setCustomRangeError(null);
        return;
      }
      if (start > end) {
        setCustomRangeError('开始日期不能晚于结束日期');
        return;
      }
      setCustomRangeError(null);
      customDates = { start, end };
      isCustomMode = true;
      resetLogsState();
      updatePeriodButtons(activePeriod);
      void refreshDashboard();
    };

    const renderOverviewFailure = (): void => {
      const module = getRequiredElement<HTMLElement>(document, '[data-module="overview"]');
      getRequiredElement<HTMLElement>(module, '[data-module-unavailable]').hidden = false;
      getRequiredElement<HTMLElement>(module, '[data-overview-grid]').hidden = true;
    };

    const renderOverviewSuccess = (metrics: Record<MetricKey, { current: number; previous: number }>): void => {
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
    };

    const renderModuleBody = (key: Exclude<ModuleKey, 'overview' | 'logs'>, copy: string): void => {
      if (copy === '暂不可用') {
        renderModuleUnavailable(key);
        return;
      }
      renderModuleList(key, [], copy);
    };

    const renderLogDetail = (item: LogsDetailItem | null): void => {
      renderLogsPanelDetail(logsRefs, item);
    };

    const renderLogsUnavailable = (): void => {
      logsTotalPages = 1;
      syncPagerButtons();
      renderLogsPanelUnavailable(logsRefs);
    };

    const renderLogsList = (data: { items: readonly LogsListItem[]; total: number; page: number; totalPages: number }): void => {
      logsTotalPages = data.totalPages;
      syncPagerButtons();
      renderLogsPanelList(
        logsRefs,
        data,
        (id) => {
          activeLogDetailId = id;
          void loadLogDetail(id);
        },
        (id) => {
          void handleSingleDelete(id);
        },
      );
    };

    const handleUnauthorized = (): void => {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      activeToken = '';
      setLoginError('expired');
      showLogin();
    };

    const loadLogDetail = async (id: string): Promise<void> => {
      const response = await fetchAdminJson(moduleEndpoints.logs, activeToken, activePeriod, `id=${encodeURIComponent(id)}`, customDates);
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const payload = await response.json();
      if (!isLogsDetailResponse(payload) || isStatsFailureResponse(payload) || activeLogDetailId !== id) {
        return;
      }
      renderLogDetail(payload.data.item);
    };

    const buildScopedQuery = (scope: 'current' | 'all'): URLSearchParams => {
      const params = new URLSearchParams();
      if (scope === 'all') {
        params.set('period', 'all');
        return params;
      }
      if (customDates) {
        params.set('startDate', customDates.start);
        params.set('endDate', customDates.end);
        return params;
      }
      params.set('period', activePeriod);
      return params;
    };

    const refreshAfterDelete = async (): Promise<void> => {
      activeLogDetailId = null;
      renderLogDetail(null);
      await refreshDashboard();
    };

    const handleSingleDelete = async (id: string): Promise<void> => {
      if (isBusy) {
        return;
      }
      setBusy(true);
      try {
        await deleteLogs(`id=${encodeURIComponent(id)}`, activeToken, handleUnauthorized);
      } finally {
        setBusy(false);
      }
      await refreshAfterDelete();
    };

    const handleRangeDelete = async (): Promise<void> => {
      if (isBusy || !customDates) {
        return;
      }
      const shouldDelete = window.confirm(`确认删除 ${customDates.start} 至 ${customDates.end} 的提问记录吗？`);
      if (!shouldDelete) {
        return;
      }
      const params = new URLSearchParams();
      params.set('rangeStart', customDates.start);
      params.set('rangeEnd', customDates.end);
      setBusy(true);
      try {
        await deleteLogs(params.toString(), activeToken, handleUnauthorized);
      } finally {
        setBusy(false);
      }
      resetLogsState();
      await refreshDashboard();
    };

    const handleClearAll = async (): Promise<void> => {
      if (isBusy) {
        return;
      }
      const shouldClear = window.confirm('确认清空全部提问记录吗？');
      if (!shouldClear) {
        return;
      }
      const confirmation = window.prompt('请输入 DELETE 以确认清空全部提问记录', '');
      if (confirmation !== 'DELETE') {
        return;
      }
      const params = new URLSearchParams();
      params.set('all', 'true');
      params.set('confirm', confirmation);
      setBusy(true);
      try {
        await deleteLogs(params.toString(), activeToken, handleUnauthorized);
      } finally {
        setBusy(false);
      }
      resetLogsState();
      await refreshDashboard();
    };

    const handleExport = async (format: 'csv' | 'json'): Promise<void> => {
      const scope = exportAllInput.checked ? 'all' : 'current';
      const params = buildScopedQuery(scope);
      params.set('format', format);
      await exportLogs(params.toString(), activeToken, format, handleUnauthorized);
    };

    const refreshDashboard = async (): Promise<void> => {
      setBusy(true);
      try {
        const responses = await Promise.all(
          Object.entries(moduleEndpoints).map(async ([key, path]) => {
            const extraQuery = key === 'logs' ? `page=${activeLogsPage}&pageSize=20` : '';
            return [key, await fetchAdminJson(path, activeToken, activePeriod, extraQuery, customDates)] as const;
          }),
        );

        for (const [key, response] of responses) {
          if (response.status === 401) {
            handleUnauthorized();
            return;
          }

          const payload = await response.json();
          if (key === 'overview') {
            if (!isOverviewResponse(payload) || isStatsFailureResponse(payload)) {
              renderOverviewFailure();
            } else {
              renderOverviewSuccess(payload.data.metrics);
            }
            continue;
          }

          if (key === 'logs') {
            if (!isLogsListResponse(payload) || isStatsFailureResponse(payload)) {
              renderLogsUnavailable();
            } else {
              renderLogsList(payload.data);
              if (!activeLogDetailId || !payload.data.items.some((item) => item.id === activeLogDetailId)) {
                activeLogDetailId = null;
                renderLogDetail(null);
              }
            }
            continue;
          }

          if (key === 'pages') {
            if (!isPagesStatsResponse(payload) || isStatsFailureResponse(payload)) {
              renderModuleUnavailable('pages');
            } else {
              renderModuleList('pages', payload.data.items.map((item) => ({
                id: item.path,
                label: item.path,
                value: new Intl.NumberFormat('zh-CN').format(item.count),
              })));
            }
            continue;
          }

          if (key === 'projects') {
            if (!isProjectsStatsResponse(payload) || isStatsFailureResponse(payload)) {
              renderModuleUnavailable('projects');
            } else {
              renderModuleList('projects', payload.data.items.map((item) => ({
                id: item.targetId,
                label: item.targetId,
                value: new Intl.NumberFormat('zh-CN').format(item.count),
              })));
            }
            continue;
          }

          if (key === 'agentSummary') {
            if (!isAgentSummaryStatsResponse(payload) || isStatsFailureResponse(payload)) {
              renderModuleUnavailable('agentSummary');
            } else {
              renderModuleList('agentSummary', payload.data.items.map((item) => ({
                id: item.keyword,
                label: item.keyword,
                value: new Intl.NumberFormat('zh-CN').format(item.count),
              })));
            }
            continue;
          }

          if (key === 'issues') {
            if (!isIssuesStatsResponse(payload) || isStatsFailureResponse(payload)) {
              renderModuleUnavailable('issues');
            } else {
              renderModuleList('issues', payload.data.items.map((item) => ({
                id: item.kind,
                label: item.kind === 'degraded'
                  ? '回答降级'
                  : item.kind === 'failed'
                    ? '回答失败'
                    : 'D1 写入失败',
                value: new Intl.NumberFormat('zh-CN').format(item.count),
                tone: item.kind === 'd1_write_failure' ? 'danger' : 'default',
              })));
            }
            continue;
          }

          renderModuleBody(key, isStatsFailureResponse(payload) ? '暂不可用' : '暂无数据');
        }
      } finally {
        setBusy(false);
      }
    };

    const submitLogin = async (): Promise<void> => {
      if (isBusy) return;
      setBusy(true);
      setLoginError(null);
      try {
        const response = await fetch('/api/admin/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenInput.value }),
        });
        const payload = await response.json();
        if (!isAdminAuthResponse(payload)) {
          setLoginError('invalid');
          return;
        }
        if (!payload.ok) {
          setLoginError(payload.reason);
          return;
        }
        activeToken = tokenInput.value;
        localStorage.setItem(ADMIN_TOKEN_KEY, activeToken);
        showDashboard();
      } finally {
        setBusy(false);
      }
      await refreshDashboard();
    };

    const resetLogsState = (): void => {
      activeLogsPage = 1;
      activeLogDetailId = null;
      logsTotalPages = 1;
      renderLogDetail(null);
      syncPagerButtons();
    };

    const logout = (): void => {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      sessionStorage.clear();
      activeToken = '';
      tokenInput.value = '';
      setLoginError(null);
      activePeriod = 'week';
      resetLogsState();
      updatePeriodButtons(activePeriod);
      showLogin();
    };

    loginButton.addEventListener('click', () => {
      void submitLogin();
    });
    tokenInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void submitLogin();
      }
    });
    logoutButton.addEventListener('click', logout);
    periodButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const period = button.dataset.period;
        if (period === 'today' || period === 'week' || period === 'month') {
          hideCustomRange();
          activePeriod = period;
          resetLogsState();
          updatePeriodButtons(period);
          void refreshDashboard();
        } else if (period === 'custom') {
          isCustomMode = true;
          showCustomRange();
          updatePeriodButtons(activePeriod);
        }
      });
    });
    startDateInput.addEventListener('change', () => applyCustomDates());
    endDateInput.addEventListener('change', () => applyCustomDates());
    logsPrevButton.addEventListener('click', () => {
      if (activeLogsPage <= 1) return;
      activeLogsPage -= 1;
      activeLogDetailId = null;
      renderLogDetail(null);
      void refreshDashboard();
    });
    logsNextButton.addEventListener('click', () => {
      if (activeLogsPage >= logsTotalPages) return;
      activeLogsPage += 1;
      activeLogDetailId = null;
      renderLogDetail(null);
      void refreshDashboard();
    });
    logsRefs.rangeDeleteButton.addEventListener('click', () => {
      void handleRangeDelete();
    });
    logsRefs.clearAllButton.addEventListener('click', () => {
      void handleClearAll();
    });
    logsRefs.exportCsvButton.addEventListener('click', () => {
      void handleExport('csv');
    });
    logsRefs.exportJsonButton.addEventListener('click', () => {
      void handleExport('json');
    });

    updatePeriodButtons(activePeriod);
    resetLogsState();
    const storedToken = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!storedToken) {
      showLogin();
      return;
    }

    activeToken = storedToken;
    tokenInput.value = storedToken;
    showDashboard();
    void refreshDashboard();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
}
