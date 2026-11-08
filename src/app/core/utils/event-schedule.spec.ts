import {
  dateBadge,
  dayDate,
  dayKey,
  endsNextDay,
  eventDayLabel,
  isScheduleComplete,
  pickedDayLabel,
  scheduleEndNote,
  scheduleOf,
  scheduleRange,
  timeSlots,
} from './event-schedule';

const HOUR = 60 * 60 * 1000;

describe('event schedule', () => {
  const evening = { date: '2026-11-14', start: '21:30', end: '23:30' };
  const overnight = { date: '2026-11-14', start: '21:30', end: '02:00' };

  it('ends on the same day when the end comes after the start', () => {
    expect(endsNextDay(evening)).toBe(false);
    const range = scheduleRange(evening)!;
    expect(new Date(range.endAt).getTime() - new Date(range.startAt).getTime()).toBe(2 * HOUR);
  });

  it('ends on the next day when the end is at or before the start', () => {
    expect(endsNextDay(overnight)).toBe(true);
    expect(endsNextDay({ ...overnight, end: '21:30' })).toBe(true);
    const range = scheduleRange(overnight)!;
    expect(new Date(range.endAt).getTime() - new Date(range.startAt).getTime()).toBe(4.5 * HOUR);
    expect(new Date(range.endAt).getDate()).toBe(15);
  });

  it('has no range while a part is missing', () => {
    expect(isScheduleComplete({ ...evening, end: '' })).toBe(false);
    expect(scheduleRange({ ...evening, date: '' })).toBeNull();
  });

  it('reads a saved night back into the same fields', () => {
    const range = scheduleRange(overnight)!;
    expect(scheduleOf(range.startAt, range.endAt)).toEqual(overnight);
  });

  it('says when an overnight night ends, and nothing for one that ends the same day', () => {
    expect(scheduleEndNote(overnight)).toBe('Finisce domenica 15 alle 02:00');
    expect(scheduleEndNote(evening)).toBeNull();
  });

  it('writes the card\'s date block and the page\'s day in Italian', () => {
    const start = scheduleRange(evening)!.startAt;
    expect(dateBadge(start)).toEqual({ weekday: 'SAB', day: '14', month: 'NOV' });
    expect(eventDayLabel(start)).toBe('Sab 14 nov');
    expect(pickedDayLabel(new Date(2026, 10, 14))).toBe('Sabato 14 novembre');
  });

  it('turns the calendar\'s day into the form\'s and back, in local time', () => {
    const day = new Date(2026, 10, 14, 23, 59);
    expect(dayKey(day)).toBe('2026-11-14');
    expect(dayDate('2026-11-14')).toEqual(new Date(2026, 10, 14));
    expect(dayDate('')).toBeNull();
  });

  it('offers every quarter of an hour, from the evening on', () => {
    const slots = timeSlots();
    expect(slots).toHaveLength(96);
    expect(slots.slice(0, 3)).toEqual(['18:00', '18:15', '18:30']);
    expect(slots).toContain('02:00');
    expect(slots.at(-1)).toBe('17:45');
  });

  it('keeps a saved time off the quarters, in its place', () => {
    const late = timeSlots('21:10');
    expect(late).toHaveLength(97);
    expect(late.slice(late.indexOf('21:00'), late.indexOf('21:00') + 3)).toEqual(['21:00', '21:10', '21:15']);
    const night = timeSlots('01:05');
    expect(night.slice(night.indexOf('01:00'), night.indexOf('01:00') + 3)).toEqual(['01:00', '01:05', '01:15']);
    const lastOne = timeSlots('17:50');
    expect(lastOne.at(-1)).toBe('17:50');
    expect(timeSlots('21:30')).toHaveLength(96);
  });
});
