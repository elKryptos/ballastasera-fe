import { UserDto, UserProfileDto } from '../models/user.model';
import { ageFrom, inCommon, joinNames, nextMilestone, ownProfileView, profileChips, profileSteps, sharedStyleIds } from './profile-view';

const salsa = { danceStyleId: 1, name: 'Salsa', slug: 'salsa', level: 'ADVANCED' as const };
const bachata = { danceStyleId: 2, name: 'Bachata', slug: 'bachata', level: 'INTERMEDIATE' as const };

function me(changes: Partial<UserDto> = {}): UserDto {
  return {
    userId: 'me',
    displayName: 'Kryptos',
    danceStyles: [salsa, bachata],
    danceRole: 'LEADER',
    whatsapp: '+393331234567',
    whatsappVisibility: 'MUTUALS',
    birthDate: '1992-09-19',
    showHomeCity: false,
    homeCity: { name: 'Milano', region: 'Lombardia', country: 'IT', latitude: 45.4, longitude: 9.1 },
    ...changes,
  } as UserDto;
}

function them(changes: Partial<UserProfileDto> = {}): UserProfileDto {
  return {
    userId: 'chiara',
    displayName: 'Chiara L.',
    danceStyles: [{ ...bachata }],
    danceRole: 'FOLLOWER',
    mutualFriends: [],
    mutualFriendsCount: 0,
    eventsTogetherCount: 0,
    lastEventTogetherTitle: null,
    lastEventTogetherStartAt: null,
    ...changes,
  } as UserProfileDto;
}

describe('ageFrom', () => {
  it('counts whole years, the birthday included', () => {
    expect(ageFrom('1992-09-19', new Date(2026, 8, 18))).toBe(33);
    expect(ageFrom('1992-09-19', new Date(2026, 8, 19))).toBe(34);
    expect(ageFrom(null)).toBeNull();
  });
});

describe('ownProfileView', () => {
  it('shows the city only when the user shows it, and no WhatsApp kept from everyone', () => {
    expect(ownProfileView(me()).homeCityName).toBeNull();
    expect(ownProfileView(me({ showHomeCity: true })).homeCityName).toBe('Milano');
    expect(ownProfileView(me({ whatsappVisibility: 'NOBODY' })).whatsapp).toBeNull();
  });

  it('reads a user stored before the social features with nothing for what\'s missing', () => {
    const view = ownProfileView(me({ followersCount: undefined as unknown as number }));
    expect(view.followersCount).toBe(0);
  });
});

describe('profileChips', () => {
  it('leaves out "Preferisco non dirlo"', () => {
    const chips = profileChips({ age: 30, gender: 'UNDISCLOSED', danceRole: 'BOTH', originCountry: null });
    expect(chips.map((chip) => chip.kind)).toEqual(['role', 'age']);
  });
});

describe('inCommon', () => {
  const date = () => '15 novembre';

  it('names the style both dance, at both levels', () => {
    const [style] = inCommon(me(), them(), date);
    expect(style).toEqual({ kind: 'style', title: 'Bachata', text: 'Tutti e due a livello Intermedio' });
  });

  it('says how roles fit, only when they do', () => {
    expect(inCommon(me(), them(), date).find((item) => item.kind === 'roles')?.text).toBe('Tu guidi, Chiara segue');
    expect(inCommon(me(), them({ danceRole: 'LEADER' }), date).some((item) => item.kind === 'roles')).toBe(false);
  });

  it('counts the friends beyond the three named, and the nights together', () => {
    const friend = (name: string) => ({ userId: name, displayName: name, avatarUrl: null, relation: 'MUTUAL' as const, profilePublic: true });
    const items = inCommon(
      me(),
      them({
        mutualFriends: [friend('Sara'), friend('Luca'), friend('Marco')],
        mutualFriendsCount: 5,
        eventsTogetherCount: 2,
        lastEventTogetherTitle: 'Noche Latina',
        lastEventTogetherStartAt: '2026-11-15T22:00:00Z',
      }),
      date,
    );
    expect(items.find((item) => item.kind === 'friends')).toEqual({
      kind: 'friends',
      title: '5 amici in comune',
      text: 'Sara, Luca, Marco e altri 2',
    });
    expect(items.find((item) => item.kind === 'nights')?.text).toBe("L'ultima: Noche Latina, 15 novembre");
  });
});

describe('joinNames', () => {
  it('joins like Italian does', () => {
    expect(joinNames(['Sara'])).toBe('Sara');
    expect(joinNames(['Sara', 'Luca'])).toBe('Sara e Luca');
    expect(joinNames(['Sara', 'Luca', 'Marco'])).toBe('Sara, Luca e Marco');
  });
});

describe('sharedStyleIds', () => {
  it('finds the styles both dance', () => {
    expect([...sharedStyleIds([salsa], [salsa, bachata])]).toEqual([1]);
  });
});

describe('nextMilestone', () => {
  it('is the first goal above the nights done', () => {
    expect(nextMilestone(27)).toEqual({ target: 50, missing: 23, percent: 54 });
    expect(nextMilestone(10)?.target).toBe(25);
    expect(nextMilestone(200)).toBeNull();
  });
});

describe('profileSteps', () => {
  it('says what\'s done and what\'s missing, in the order they\'re suggested', () => {
    const steps = profileSteps(me({ avatarUrl: 'https://x/p.jpg', bio: ' ', instagram: 'k', schoolName: null }));
    expect(steps.filter((step) => step.done).map((step) => step.key)).toEqual(['photo', 'styles', 'instagram']);
    expect(steps.find((step) => !step.done)?.todoLabel).toBe('Scrivi due righe su di te');
  });
});
