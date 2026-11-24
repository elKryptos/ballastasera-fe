import { afterFollow, afterUnfollow, followsMe, iFollow, isFriend } from './relation';

describe('relation', () => {
  it('reads each side of the pair', () => {
    expect(iFollow('FOLLOWING')).toBe(true);
    expect(iFollow('FOLLOWED_BY')).toBe(false);
    expect(followsMe('FOLLOWED_BY')).toBe(true);
    expect(followsMe('MUTUAL')).toBe(true);
    expect(isFriend('MUTUAL')).toBe(true);
    expect(isFriend(null)).toBe(false);
  });

  it('turns "Ricambia" into friends when followed back', () => {
    expect(afterFollow('FOLLOWED_BY')).toBe('MUTUAL');
    expect(afterFollow('NONE')).toBe('FOLLOWING');
  });

  it('leaves a friend at "Ricambia" when unfollowed', () => {
    expect(afterUnfollow('MUTUAL')).toBe('FOLLOWED_BY');
    expect(afterUnfollow('FOLLOWING')).toBe('NONE');
  });
});
