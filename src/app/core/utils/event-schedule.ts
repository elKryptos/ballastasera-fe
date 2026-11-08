import { capitalize } from './event-filters';

/** A night's time as its form asks for it: one day, the time it starts and the time it ends.
 * An end at or before the start is on the next day: "21:30 – 02:00" ends after midnight. */
export interface EventSchedule {
  /** yyyy-MM-dd, the local day (the form's calendar keeps it so). */
  date: string;
  /** HH:mm, one of timeSlots() or a saved time off them. */
  start: string;
  end: string;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Where the times' list starts: the evening, when most nights do. */
const FIRST_SLOT_HOUR = 18;
const SLOT_MINUTES = 15;

/** A local day as the form keeps it: yyyy-MM-dd. */
export function dayKey(at: Date): string {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** A yyyy-MM-dd back into its local day, at midnight. Null when there's none. */
export function dayDate(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

/** The times a night can start or end at: every quarter of an hour, from the evening round to the
 * next afternoon (18:00 … 17:45). A saved time off the quarters (21:10) is kept, in its place. */
export function timeSlots(keep?: string | null): string[] {
  const slots = Array.from({ length: (24 * 60) / SLOT_MINUTES }, (_, i) => {
    const minutes = (FIRST_SLOT_HOUR * 60 + i * SLOT_MINUTES) % (24 * 60);
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  });
  if (!keep || !/^\d{2}:\d{2}$/.test(keep) || slots.includes(keep)) return slots;
  // After the last slot that comes before it on the evening-first clock.
  const order = (time: string) => (time < `${pad(FIRST_SLOT_HOUR)}:00` ? '1' : '0') + time;
  const at = slots.findIndex((slot) => order(slot) > order(keep));
  return at === -1 ? [...slots, keep] : [...slots.slice(0, at), keep, ...slots.slice(at)];
}

/** The local day and time of an instant, as the form keeps them. */
function localParts(iso: string): { date: string; time: string } {
  const at = new Date(iso);
  return { date: dayKey(at), time: `${pad(at.getHours())}:${pad(at.getMinutes())}` };
}

/** A local day and time. Built from its parts, not parsed from a string, so it's always local. */
function localDate(date: string, time: string, plusDays = 0): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, day + plusDays, hours, minutes);
}

export function isScheduleComplete(schedule: EventSchedule): boolean {
  return Boolean(schedule.date && schedule.start && schedule.end);
}

/** The end falls on the day after: it's at or before the start. */
export function endsNextDay(schedule: EventSchedule): boolean {
  return Boolean(schedule.start && schedule.end && schedule.end <= schedule.start);
}

/** The instants the backend wants, in ISO. Null while a part is missing. */
export function scheduleRange(schedule: EventSchedule): { startAt: string; endAt: string } | null {
  if (!isScheduleComplete(schedule)) return null;
  return {
    startAt: localDate(schedule.date, schedule.start).toISOString(),
    endAt: localDate(schedule.date, schedule.end, endsNextDay(schedule) ? 1 : 0).toISOString(),
  };
}

/** A saved night's time, back into the form's three fields. */
export function scheduleOf(startAt: string, endAt: string): EventSchedule {
  const start = localParts(startAt);
  return { date: start.date, start: start.time, end: localParts(endAt).time };
}

/** "Finisce sabato 15 alle 02:00", under the times, only when it ends on the next day. */
export function scheduleEndNote(schedule: EventSchedule): string | null {
  const range = scheduleRange(schedule);
  if (!range || !endsNextDay(schedule)) return null;
  const day = new Date(range.endAt).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric' });
  return `Finisce ${day} alle ${schedule.end}`;
}

/** The date block of a night's card: "VEN", "14", "NOV". */
export function dateBadge(iso: string): { weekday: string; day: string; month: string } {
  const at = new Date(iso);
  const part = (options: Intl.DateTimeFormatOptions) =>
    at.toLocaleDateString('it-IT', options).replace('.', '').toUpperCase();
  return { weekday: part({ weekday: 'short' }), day: String(at.getDate()), month: part({ month: 'short' }) };
}

/** "Ven 14 nov": the day, as a night's page writes it. */
export function eventDayLabel(iso: string): string {
  return capitalize(new Date(iso).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }));
}

/** "Venerdì 14 novembre": the day picked in the form's calendar. */
export function pickedDayLabel(day: Date): string {
  return capitalize(day.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }));
}
