import { getRequiredElement, type LogsDetailItem, type LogsListItem, type LogsSessionDetail, type LogsSessionTurnItem } from './admin-dashboard-shared';

function formatShanghaiTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}`;
}

type LogsRefs = {
  readonly unavailable: HTMLElement;
  readonly content: HTMLElement;
  readonly total: HTMLElement;
  readonly pageInfo: HTMLElement;
  readonly list: HTMLElement;
  readonly detail: HTMLElement;
  readonly sessionSummary: HTMLElement;
  readonly sessionTurns: HTMLElement;
  readonly detailFields: HTMLElement;
  readonly prevButton: HTMLButtonElement;
  readonly nextButton: HTMLButtonElement;
  readonly exportCsvButton: HTMLButtonElement;
  readonly exportJsonButton: HTMLButtonElement;
  readonly rangeDeleteButton: HTMLButtonElement;
  readonly clearAllButton: HTMLButtonElement;
};

export function getLogsRefs(): LogsRefs {
  return {
    unavailable: getRequiredElement<HTMLElement>(document, '[data-logs-unavailable]'),
    content: getRequiredElement<HTMLElement>(document, '[data-logs-content]'),
    total: getRequiredElement<HTMLElement>(document, '[data-logs-total]'),
    pageInfo: getRequiredElement<HTMLElement>(document, '[data-logs-page-info]'),
    list: getRequiredElement<HTMLElement>(document, '[data-logs-list]'),
    detail: getRequiredElement<HTMLElement>(document, '[data-log-detail]'),
    sessionSummary: getRequiredElement<HTMLElement>(document, '[data-log-session-summary]'),
    sessionTurns: getRequiredElement<HTMLElement>(document, '[data-log-session-turns]'),
    detailFields: getRequiredElement<HTMLElement>(document, '[data-log-detail-fields]'),
    prevButton: getRequiredElement<HTMLButtonElement>(document, '[data-logs-prev]'),
    nextButton: getRequiredElement<HTMLButtonElement>(document, '[data-logs-next]'),
    exportCsvButton: getRequiredElement<HTMLButtonElement>(document, '[data-export-format="csv"]'),
    exportJsonButton: getRequiredElement<HTMLButtonElement>(document, '[data-export-format="json"]'),
    rangeDeleteButton: getRequiredElement<HTMLButtonElement>(document, '[data-range-delete]'),
    clearAllButton: getRequiredElement<HTMLButtonElement>(document, '[data-clear-all]'),
  };
}

export function syncLogsButtons(refs: LogsRefs, state: { isBusy: boolean; page: number; totalPages: number }): void {
  refs.prevButton.disabled = state.isBusy || state.page <= 1;
  refs.nextButton.disabled = state.isBusy || state.page >= state.totalPages;
  refs.exportCsvButton.disabled = state.isBusy;
  refs.exportJsonButton.disabled = state.isBusy;
  refs.rangeDeleteButton.disabled = state.isBusy;
  refs.clearAllButton.disabled = state.isBusy;
}

export function renderLogDetail(refs: LogsRefs, item: LogsDetailItem | null): void {
  refs.sessionSummary.replaceChildren();
  refs.sessionTurns.replaceChildren();
  refs.detailFields.replaceChildren();
  if (!item) {
    refs.detail.hidden = true;
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
    refs.detailFields.append(term, description);
  }

  refs.detail.hidden = false;
}

export function renderLogSessionDetail(
  refs: LogsRefs,
  data: { session: LogsSessionDetail; turns: readonly LogsSessionTurnItem[] } | null,
  onTurnSelect?: (id: string) => void,
): void {
  refs.sessionSummary.replaceChildren();
  refs.sessionTurns.replaceChildren();
  refs.detailFields.replaceChildren();
  if (!data) {
    refs.detail.hidden = true;
    return;
  }

  refs.sessionSummary.textContent = `${data.session.visitorUuidShort} ${data.session.agentSessionIdShort} ${data.session.turnCount}`;
  for (const turn of data.turns) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'log-row';
    row.dataset.sessionTurn = turn.id;
    row.textContent = turn.userMessage;
    row.addEventListener('click', () => {
      onTurnSelect?.(turn.id);
    });
    refs.sessionTurns.appendChild(row);
  }

  refs.detail.hidden = false;
}

export function renderLogsUnavailable(refs: LogsRefs): void {
  refs.unavailable.hidden = false;
  refs.content.hidden = true;
  renderLogDetail(refs, null);
}

export function renderLogsList(
  refs: LogsRefs,
  data: { items: readonly LogsListItem[]; total: number; page: number; totalPages: number },
  onSelect: (id: string) => void,
  onDelete: (id: string) => void,
): void {
  refs.unavailable.hidden = true;
  refs.content.hidden = false;
  refs.total.textContent = `共 ${data.total} 段会话`;
  refs.pageInfo.textContent = `第 ${data.page} / ${data.totalPages} 页`;
  refs.list.replaceChildren();

  for (const item of data.items) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'log-row';
    row.dataset.logRow = item.id;
    row.innerHTML = [
      `<span class="log-row-meta">${formatShanghaiTime(item.lastTurnAt)}</span>`,
      `<span class="log-row-message">${item.latestUserMessage}</span>`,
      `<span class="log-chip">${item.turnCount} 轮</span>`,
      `<span class="log-chip status-success">${item.agentSessionIdShort}</span>`,
    ].join('');
    row.addEventListener('click', () => onSelect(item.id));

    const actions = document.createElement('span');
    actions.className = 'log-row-actions';
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'log-delete-button';
    deleteButton.dataset.logDelete = item.id;
    deleteButton.textContent = '删除';
    deleteButton.addEventListener('click', (event) => {
      event.stopPropagation();
      onDelete(item.id);
    });
    actions.appendChild(deleteButton);
    row.appendChild(actions);
    refs.list.appendChild(row);
  }
}
