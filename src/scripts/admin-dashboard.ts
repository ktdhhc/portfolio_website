import {
  ADMIN_TOKEN_KEY,
  assertNever,
  formatComparisonCopy,
  formatMetricValue,
  getComparisonState,
  getRequiredElement,
  isAdminAuthResponse,
  isLogsDetailResponse,
  isLogsListResponse,
  isOverviewResponse,
  isStatsFailureResponse,
  moduleEndpoints,
  type AdminAuthFailureReason,
  type AdminStatsPeriod,
  type LogsDetailItem,
  type LogsListItem,
  type MetricKey,
  type ModuleKey,
} from './admin-dashboard-shared';

function fetchAdminJson(path: string, token: string, period: AdminStatsPeriod, extraQuery = '', customDates?: { start: string; end: string }): Promise<Response> {
  const params: string[] = [];
  if (customDates) {
    params.push(`startDate=${customDates.start}`, `endDate=${customDates.end}`);
  } else {
    params.push(`period=${period}`);
  }
  if (extraQuery) params.push(extraQuery);
  return fetch(`${path}?${params.join('&')}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

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
      logsPrevButton.disabled = isBusy || activeLogsPage <= 1;
      logsNextButton.disabled = isBusy || activeLogsPage >= logsTotalPages;
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

    const applyCustomDates = (): void => {
      const start = startDateInput.value;
      const end = endDateInput.value;
      if (!start || !end || start > end) return;
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
      const module = getRequiredElement<HTMLElement>(document, `[data-module="${key}"]`);
      getRequiredElement<HTMLElement>(module, '[data-module-body]').textContent = copy;
    };

    const renderLogDetail = (item: LogsDetailItem | null): void => {
      const detail = getRequiredElement<HTMLElement>(document, '[data-log-detail]');
      const fields = getRequiredElement<HTMLElement>(document, '[data-log-detail-fields]');
      fields.replaceChildren();

      if (!item) {
        detail.hidden = true;
        return;
      }

      const entries: ReadonlyArray<readonly [string, string]> = [
        ['创建时间', item.createdAt],
        ['问题全文', item.userMessage],
        ['回答全文', item.assistantAnswer],
        ['turnType', item.turnType],
        ['answerStatus', item.answerStatus],
        ['durationMs', String(item.durationMs)],
        ['toolTrace', `toolCalls ${item.toolTraceSummary.toolCalls}${item.toolTraceSummary.files.length > 0 ? ` | ${item.toolTraceSummary.files.join(', ')}` : ''}`],
        ['visitorUuid', item.visitorUuidShort],
        ['agentSessionId', item.agentSessionIdShort],
      ];

      for (const [label, value] of entries) {
        const term = document.createElement('dt');
        term.textContent = label;
        const description = document.createElement('dd');
        description.textContent = value;
        fields.append(term, description);
      }

      detail.hidden = false;
    };

    const renderLogsUnavailable = (): void => {
      getRequiredElement<HTMLElement>(document, '[data-logs-unavailable]').hidden = false;
      getRequiredElement<HTMLElement>(document, '[data-logs-content]').hidden = true;
      logsTotalPages = 1;
      syncPagerButtons();
      renderLogDetail(null);
    };

    const renderLogsList = (data: { items: readonly LogsListItem[]; total: number; page: number; totalPages: number }): void => {
      getRequiredElement<HTMLElement>(document, '[data-logs-unavailable]').hidden = true;
      getRequiredElement<HTMLElement>(document, '[data-logs-content]').hidden = false;
      getRequiredElement<HTMLElement>(document, '[data-logs-total]').textContent = `共 ${data.total} 条记录`;
      getRequiredElement<HTMLElement>(document, '[data-logs-page-info]').textContent = `第 ${data.page} / ${data.totalPages} 页`;
      logsTotalPages = data.totalPages;
      syncPagerButtons();

      const list = getRequiredElement<HTMLElement>(document, '[data-logs-list]');
      list.replaceChildren();
      for (const item of data.items) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'log-row';
        row.dataset.logRow = item.id;
        row.innerHTML = [
          `<span class="log-row-meta">${item.createdAt}</span>`,
          `<span class="log-row-message">${item.userMessage}</span>`,
          `<span class="log-chip">${item.turnType}</span>`,
          `<span class="log-chip status-${item.answerStatus}">${item.answerStatus}</span>`,
        ].join('');
        row.addEventListener('click', () => {
          activeLogDetailId = item.id;
          void loadLogDetail(item.id);
        });
        list.appendChild(row);
      }
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

          renderModuleBody(key, isStatsFailureResponse(payload) ? '暂不可用' : '模块已连接，详情将在后续 issue 完成。');
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
    startDateInput.addEventListener('change', () => {
      if (startDateInput.value && endDateInput.value) applyCustomDates();
    });
    endDateInput.addEventListener('change', () => {
      if (startDateInput.value && endDateInput.value) applyCustomDates();
    });
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
