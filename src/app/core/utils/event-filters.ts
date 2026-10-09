import { EventCardDto, EventType } from '../models/event.model';

/** Filters shared by /mappa and /lista (and the menu's Stasera, which takes
 * the same tonight and order). All of them run client-side over what
 * the backend already sent: GET /rest/events only takes a bounding box (and a
 * city), and returns every live or upcoming event of the next 3 weeks in it —
 * so switching day or style never costs a request. */

/** A night out runs past midnight: until this hour of the next morning it
 * still belongs to the evening before — at 2am "stasera" is still last night. */
const NIGHT_ENDS_AT_HOUR = 6;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export type DateRange = 'tonight' | 'tomorrow' | 'weekend' | 'week' | 'all';

/** Tutte le date first: it's the default (EventFiltersService.range). */
export const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: 'all', label: 'Tutte le date' },
  { value: 'tonight', label: 'Stasera' },
  { value: 'tomorrow', label: 'Domani' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'week', label: 'Settimana' },
];

/** In the URL, for links straight to a search: /lista?quando=domani. */
export const DATE_RANGE_SLUGS: Record<DateRange, string> = {
  tonight: 'stasera',
  tomorrow: 'domani',
  weekend: 'weekend',
  week: 'settimana',
  all: 'tutte',
};

export function dateRangeFromSlug(slug: string | null): DateRange | null {
  const match = Object.entries(DATE_RANGE_SLUGS).find(([, value]) => value === slug);
  return match ? (match[0] as DateRange) : null;
}

/** How a range reads after a count: "3 serate stasera", "5 serate nel weekend". */
export const DATE_RANGE_PHRASES: Record<DateRange, string> = {
  tonight: 'stasera',
  tomorrow: 'domani',
  weekend: 'nel weekend',
  week: 'questa settimana',
  all: 'in programma',
};

export interface EventFilterState {
  range: DateRange;
  /** Display names, as the backend sends them in EventCardDto.danceStyles. */
  styles: ReadonlySet<string>;
  types: ReadonlySet<EventType>;
  freeOnly: boolean;
}

/** The night an instant belongs to, as a day number (local calendar date,
 * counted from 1970-01-01): anything before NIGHT_ENDS_AT_HOUR counts as the
 * day before. Plain numbers so "tomorrow" is just +1. */
export function nightOf(time: number): number {
  const date = new Date(time - NIGHT_ENDS_AT_HOUR * HOUR_MS);
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

/** The night an event belongs to: the one it starts on, or tonight while it's
 * underway — an all-nighter or a weekend festival that began earlier is still
 * something to go to tonight. */
export function eventNight(event: { startAt: string }, now: number): number {
  const start = Date.parse(event.startAt);
  return nightOf(start <= now ? now : start);
}

/** 0 = Sunday … 6 = Saturday, like Date.getDay(). */
function weekdayOf(night: number): number {
  return new Date(night * DAY_MS).getUTCDay();
}

/** First and last night of a range (both included), or null for no limit. */
function rangeNights(range: DateRange, now: number): [number, number] | null {
  const tonight = nightOf(now);
  switch (range) {
    case 'tonight':
      return [tonight, tonight];
    case 'tomorrow':
      return [tonight + 1, tonight + 1];
    case 'week':
      return [tonight, tonight + 6];
    case 'weekend': {
      // Friday, Saturday and Sunday nights: what's left of this weekend while
      // it's on, the next one otherwise.
      const weekday = weekdayOf(tonight);
      if (weekday === 0) return [tonight, tonight];
      if (weekday >= 5) return [tonight, tonight + 7 - weekday];
      return [tonight + 5 - weekday, tonight + 7 - weekday];
    }
    case 'all':
      return null;
  }
}

/** Last night a range covers, or null when it has no end — see
 * MapPage.truncatedForRange, which uses it to tell whether the backend's cap
 * on results actually cut anything the range would show. */
export function rangeLastNight(range: DateRange, now: number): number | null {
  return rangeNights(range, now)?.[1] ?? null;
}

export function inDateRange(event: { startAt: string; endAt: string }, range: DateRange, now: number): boolean {
  // Over since it was fetched: the page may sit open for hours between searches.
  if (Date.parse(event.endAt) < now) return false;
  const nights = rangeNights(range, now);
  if (!nights) return true;
  const night = eventNight(event, now);
  return night >= nights[0] && night <= nights[1];
}

export function matchesEventFilters(event: EventCardDto, filters: EventFilterState, now: number): boolean {
  if (!inDateRange(event, filters.range, now)) return false;
  if (filters.freeOnly && !event.free) return false;
  if (filters.types.size > 0 && !filters.types.has(event.eventType)) return false;
  if (filters.styles.size > 0 && !event.danceStyles.some((style) => filters.styles.has(style))) return false;
  return true;
}

/** Live first, then by start time — the order every list of events shows. */
export function compareByLiveThenStart(a: EventCardDto, b: EventCardDto, now: number): number {
  const liveA = Date.parse(a.startAt) <= now;
  const liveB = Date.parse(b.startAt) <= now;
  return Number(liveB) - Number(liveA) || Date.parse(a.startAt) - Date.parse(b.startAt);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A night's date: "giovedì 1 ottobre", or "gio 1 ott" short. The day number
 * is a UTC midnight (see nightOf), so it's formatted in UTC. */
function nightDate(night: number, style: 'long' | 'short'): string {
  return new Date(night * DAY_MS).toLocaleDateString('it-IT', {
    weekday: style,
    day: 'numeric',
    month: style,
    timeZone: 'UTC',
  });
}

/** Day heading of a night: "Stasera · giovedì 1 ottobre", "Domani · …", then
 * "Sabato 3 ottobre". */
export function nightHeading(night: number, now: number): string {
  const long = nightDate(night, 'long');
  const tonight = nightOf(now);
  if (night === tonight) return `Stasera · ${long}`;
  if (night === tonight + 1) return `Domani · ${long}`;
  return capitalize(long);
}

/** Short name of an event's night: "Stasera", "Domani", or "Sab 3 ott". */
export function nightShortLabel(event: { startAt: string }, now: number): string {
  const night = eventNight(event, now);
  const tonight = nightOf(now);
  if (night === tonight) return 'Stasera';
  if (night === tonight + 1) return 'Domani';
  return capitalize(nightDate(night, 'short'));
}

/** The event page's date line: "Stasera, gio 1 ott", "Domani, ven 2 ott", or
 * "Sabato 3 ottobre" further out. By the night it starts on (not eventNight:
 * a page can be opened long after, from a shared link). */
export function nightDateLabel(event: { startAt: string }, now: number): string {
  const night = nightOf(Date.parse(event.startAt));
  const tonight = nightOf(now);
  if (night === tonight) return `Stasera, ${nightDate(night, 'short')}`;
  if (night === tonight + 1) return `Domani, ${nightDate(night, 'short')}`;
  return capitalize(nightDate(night, 'long'));
}
