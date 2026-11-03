const DATE_TIME_FORMAT = new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' });
const DAY_FORMAT = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });

function parse(iso: string | null | undefined): Date | null {
  const date = new Date(iso ?? '');
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "3 nov 2026, 21:40". Empty rather than a crash for a date that doesn't parse. */
export function requestDateLabel(iso: string | null | undefined): string {
  const date = parse(iso);
  return date ? DATE_TIME_FORMAT.format(date) : '';
}

/** "oggi", "ieri" or "il 3 nov", by the calendar: what follows "inviata". */
export function requestDayLabel(iso: string | null | undefined, now = new Date()): string {
  const date = parse(iso);
  if (!date) return '';
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  // Rounded: a day with a daylight saving change isn't 24 hours long.
  const daysAgo = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (daysAgo === 0) return 'oggi';
  if (daysAgo === 1) return 'ieri';
  return `il ${DAY_FORMAT.format(date)}`;
}
