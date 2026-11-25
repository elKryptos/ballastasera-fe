import { nightTile } from './event-filters';

describe('nightTile', () => {
  // Tuesday 24 November 2026, 21:00 local time.
  const now = new Date(2026, 10, 24, 21, 0).getTime();

  it('says OGGI for tonight, also for a night that began earlier and is still on', () => {
    expect(nightTile({ startAt: new Date(2026, 10, 24, 22, 0).toISOString() }, now)).toEqual({
      weekday: 'OGGI',
      day: 24,
      tonight: true,
    });
    expect(nightTile({ startAt: new Date(2026, 10, 23, 20, 0).toISOString() }, now).tonight).toBe(true);
  });

  it('gives a later night its weekday and day', () => {
    expect(nightTile({ startAt: new Date(2026, 10, 29, 19, 0).toISOString() }, now)).toEqual({
      weekday: 'DOM',
      day: 29,
      tonight: false,
    });
  });
});
