export const adminStatsPeriods = ['today', 'week', 'month'] as const;

const shanghaiOffsetMs = 8 * 60 * 60 * 1000;

export type AdminStatsPeriod = (typeof adminStatsPeriods)[number];

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
  copy.setDate(copy.getDate() + days);
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
  const dayStart = startOfDay(date);
  const weekDay = dayStart.getDay();
  const diff = weekDay === 0 ? -6 : 1 - weekDay;
  return addDays(dayStart, diff);
}

function startOfMonth(date: Date): Date {
  const shifted = toShanghaiShifted(date);
  return fromShanghaiParts(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1);
}

function previousMonthStart(date: Date): Date {
  const shifted = toShanghaiShifted(date);
  return fromShanghaiParts(shifted.getUTCFullYear(), shifted.getUTCMonth() - 1, 1);
}

export function parseAdminStatsPeriod(value: string | null): AdminStatsPeriod {
  if (value === 'today' || value === 'week' || value === 'month') {
    return value;
  }

  return 'week';
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
