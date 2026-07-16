export const adminStatsPeriods = ['today', 'week', 'month'] as const;

const shanghaiOffsetMs = 8 * 60 * 60 * 1000;

export type AdminStatsPeriod = (typeof adminStatsPeriods)[number];

export class InvalidDateRangeError extends Error {
  constructor() {
    super('invalid_date_range');
    this.name = 'InvalidDateRangeError';
  }
}

export type ComparisonWindow = {
  readonly current: {
    readonly startInclusive: string;
    readonly endExclusive: string;
  };
  readonly previous: {
    readonly startInclusive: string;
    readonly endExclusive: string;
  };
};

function toShanghaiShifted(date: Date): Date {
  return new Date(date.getTime() + shanghaiOffsetMs);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function fromShanghaiParts(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - shanghaiOffsetMs);
}

function startOfDay(date: Date): Date {
  const shifted = toShanghaiShifted(date);
  return fromShanghaiParts(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
}

function startOfWeek(date: Date): Date {
  const shifted = toShanghaiShifted(date);
  const weekDay = shifted.getUTCDay();
  const diff = weekDay === 0 ? -6 : 1 - weekDay;
  return fromShanghaiParts(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + diff);
}

function startOfMonth(date: Date): Date {
  const shifted = toShanghaiShifted(date);
  return fromShanghaiParts(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1);
}

function previousMonthStart(date: Date): Date {
  const shifted = toShanghaiShifted(date);
  return fromShanghaiParts(shifted.getUTCFullYear(), shifted.getUTCMonth() - 1, 1);
}

function parseShanghaiDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new InvalidDateRangeError();
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month || probe.getUTCDate() !== day) {
    throw new InvalidDateRangeError();
  }
  return fromShanghaiParts(year, month, day);
}

export function parseAdminStatsPeriod(value: string | null): AdminStatsPeriod {
  if (value === 'today' || value === 'week' || value === 'month') {
    return value;
  }

  return 'week';
}

export function getCustomWindow(startDate: string, endDate: string): ComparisonWindow {
  const start = parseShanghaiDate(startDate);
  const end = parseShanghaiDate(endDate);
  if (start > end) {
    throw new InvalidDateRangeError();
  }
  // end 加一天，使其成为 exclusive 上界（包含 endDate 当天）
  const endExclusive = addDays(end, 1);
  const durationMs = endExclusive.getTime() - start.getTime();
  const previousEnd = start;
  const previousStart = new Date(previousEnd.getTime() - durationMs);
  return {
    current: {
      startInclusive: start.toISOString(),
      endExclusive: endExclusive.toISOString(),
    },
    previous: {
      startInclusive: previousStart.toISOString(),
      endExclusive: previousEnd.toISOString(),
    },
  };
}

export function resolveWindow(url: URL): ComparisonWindow {
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  if (url.searchParams.has('startDate') || url.searchParams.has('endDate')) {
    if (!startDate || !endDate) throw new InvalidDateRangeError();
    return getCustomWindow(startDate, endDate);
  }
  const period = parseAdminStatsPeriod(url.searchParams.get('period'));
  return getComparisonWindow(period);
}

export function getComparisonWindow(period: AdminStatsPeriod, now = new Date()): ComparisonWindow {
  switch (period) {
    case 'today': {
      const todayStart = startOfDay(now);
      const yesterdayStart = addDays(todayStart, -1);
      return {
        current: {
          startInclusive: todayStart.toISOString(),
          endExclusive: now.toISOString(),
        },
        previous: {
          startInclusive: yesterdayStart.toISOString(),
          endExclusive: todayStart.toISOString(),
        },
      };
    }
    case 'week': {
      const thisWeekStart = startOfWeek(now);
      const previousWeekStart = addDays(thisWeekStart, -7);
      return {
        current: {
          startInclusive: thisWeekStart.toISOString(),
          endExclusive: now.toISOString(),
        },
        previous: {
          startInclusive: previousWeekStart.toISOString(),
          endExclusive: thisWeekStart.toISOString(),
        },
      };
    }
    case 'month': {
      const thisMonthStart = startOfMonth(now);
      const prevMonthStart = previousMonthStart(now);
      return {
        current: {
          startInclusive: thisMonthStart.toISOString(),
          endExclusive: now.toISOString(),
        },
        previous: {
          startInclusive: prevMonthStart.toISOString(),
          endExclusive: thisMonthStart.toISOString(),
        },
      };
    }
  }
}
