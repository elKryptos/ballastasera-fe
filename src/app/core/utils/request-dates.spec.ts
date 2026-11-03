import { requestDateLabel, requestDayLabel } from './request-dates';

describe('request dates', () => {
  const now = new Date(2026, 10, 3, 21, 0);

  it.each([
    [new Date(2026, 10, 3, 0, 5), 'oggi'],
    [new Date(2026, 10, 2, 23, 55), 'ieri'],
    [new Date(2026, 9, 31, 12, 0), 'il 31 ott'],
  ])('%s reads as %s', (date, label) => {
    expect(requestDayLabel(date.toISOString(), now)).toBe(label);
  });

  it('counts calendar days across a clock change', () => {
    // Italy goes back an hour on 25 Oct 2026: that day has 25 hours.
    expect(requestDayLabel(new Date(2026, 9, 25, 1, 0).toISOString(), new Date(2026, 9, 26, 0, 30))).toBe('ieri');
  });

  it.each([null, undefined, 'not a date'])('leaves %s empty rather than crash', (value) => {
    expect(requestDayLabel(value, now)).toBe('');
    expect(requestDateLabel(value)).toBe('');
  });
});
