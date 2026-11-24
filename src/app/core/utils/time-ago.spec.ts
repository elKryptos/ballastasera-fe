import { timeAgo } from './time-ago';

describe('timeAgo', () => {
  const now = new Date(2026, 10, 24, 21, 0).getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it('says it short, the way a feed does', () => {
    expect(timeAgo(ago(20_000), now)).toBe('ora');
    expect(timeAgo(ago(12 * 60_000), now)).toBe('12 min');
    expect(timeAgo(ago(2 * 3_600_000 + 60_000), now)).toBe('2 h');
    expect(timeAgo(ago(3 * 86_400_000), now)).toBe('3 g');
  });

  it('gives the date past a week', () => {
    expect(timeAgo(new Date(2026, 10, 12, 20, 0).toISOString(), now)).toBe('12 nov');
  });
});
