import { flagEmoji } from './flags';

describe('flagEmoji', () => {
  it('turns two ISO letters into the flag', () => {
    expect(flagEmoji('IT')).toBe('🇮🇹');
    expect(flagEmoji('us')).toBe('🇺🇸');
  });

  it('gives nothing for anything else', () => {
    expect(flagEmoji(null)).toBe('');
    expect(flagEmoji('')).toBe('');
    expect(flagEmoji('ITA')).toBe('');
    expect(flagEmoji('1T')).toBe('');
  });
});
