import { getRequiredElement, type LogsDetailItem, type LogsListItem } from './admin-dashboard-shared';

type LogsRefs = {
  readonly unavailable: HTMLElement;
  readonly content: HTMLElement;
  readonly total: HTMLElement;
  readonly pageInfo: HTMLElement;
  readonly list: HTMLElement;
  readonly detail: HTMLElement;
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
  refs.total.textContent = `共 ${data.total} 条记录`;
  refs.pageInfo.textContent = `第 ${data.page} / ${data.totalPages} 页`;
  refs.list.replaceChildren();

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
