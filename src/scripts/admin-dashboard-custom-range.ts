import type { AdminStatsPeriod } from './admin-dashboard-shared';

type CustomRangeRefs = {
  readonly container: HTMLElement;
  readonly error: HTMLParagraphElement;
  readonly startInput: HTMLInputElement;
  readonly endInput: HTMLInputElement;
};

export type CustomDates = { readonly start: string; readonly end: string };

export function toShanghaiCustomRange(start: string, end: string): { startInclusive: string; endExclusive: string } {
  const startInclusive = new Date(`${start}T00:00:00+08:00`).toISOString();
  const endExclusive = new Date(new Date(`${end}T00:00:00+08:00`).getTime() + 24 * 60 * 60 * 1000).toISOString();
  return { startInclusive, endExclusive };
}

export function createCustomRangeController(
  refs: CustomRangeRefs,
  onValidChange: () => void,
  updatePeriodButtons: (period: AdminStatsPeriod) => void,
  activePeriod: () => AdminStatsPeriod,
) {
  let isCustomMode = false;
  let customDates: CustomDates | undefined;

  function setError(message: string | null): void {
    if (message === null) {
      refs.error.hidden = true;
      refs.error.textContent = '';
      refs.startInput.removeAttribute('aria-invalid');
      refs.endInput.removeAttribute('aria-invalid');
      return;
    }

    refs.error.hidden = false;
    refs.error.textContent = message;
    refs.startInput.setAttribute('aria-invalid', 'true');
    refs.endInput.setAttribute('aria-invalid', 'true');
  }

  function currentRange(): CustomDates | null {
    const start = refs.startInput.value;
    const end = refs.endInput.value;
    if (!start || !end) {
      setError(null);
      return null;
    }
    if (start > end) {
      setError('开始日期不能晚于结束日期');
      return null;
    }
    setError(null);
    return { start, end };
  }

  function applyIfValid(): void {
    const range = currentRange();
    if (!range) return;
    customDates = range;
    isCustomMode = true;
    updatePeriodButtons(activePeriod());
    onValidChange();
  }

  return {
    show(): void {
      refs.container.classList.remove('hidden');
      isCustomMode = true;
      updatePeriodButtons(activePeriod());
    },
    hide(): void {
      refs.container.classList.add('hidden');
      refs.startInput.value = '';
      refs.endInput.value = '';
      customDates = undefined;
      isCustomMode = false;
      setError(null);
    },
    bind(): void {
      refs.startInput.addEventListener('change', () => {
        if (refs.startInput.value && refs.endInput.value) applyIfValid();
        else setError(null);
      });
      refs.endInput.addEventListener('change', () => {
        if (refs.startInput.value && refs.endInput.value) applyIfValid();
        else setError(null);
      });
    },
    requireValidRange(emptyMessage: string): CustomDates | null {
      const range = currentRange();
      if (!range) {
        if (!refs.startInput.value || !refs.endInput.value) setError(emptyMessage);
        return null;
      }
      customDates = range;
      isCustomMode = true;
      updatePeriodButtons(activePeriod());
      return range;
    },
    isCustomMode(): boolean {
      return isCustomMode;
    },
    customDates(): CustomDates | undefined {
      return customDates;
    },
  };
}
