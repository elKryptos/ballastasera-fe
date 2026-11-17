import { type BrnCalendarI18n } from '@spartan-ng/brain/calendar';

const WEEKDAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
export const MONTHS = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
] as const;

/** Spartan's calendar in Italian, the week from Monday: the night's "Giorno" (DayPicker) and the
 * birth date in "Il tuo account" (BirthDatePicker), each with provideBrnCalendarI18n. */
export const CALENDAR_IT: Partial<BrnCalendarI18n> = {
  formatWeekdayName: (index) => WEEKDAYS[index].slice(0, 2).toUpperCase(),
  labelWeekday: (index) => WEEKDAYS[index],
  months: () => [...MONTHS],
  formatHeader: (month, year) => `${MONTHS[month]} ${year}`,
  formatMonth: (month) => MONTHS[month].slice(0, 3),
  formatYear: (year) => String(year),
  labelPrevious: () => 'Mese precedente',
  labelNext: () => 'Mese successivo',
  firstDayOfWeek: () => 1,
};
