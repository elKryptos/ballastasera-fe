import { UserDto } from '../models/user.model';
import { ProfileFormValue, profileFormValue, sameProfile, toUserUpdate } from './user-update';

const user: UserDto = {
  userId: 'u1',
  email: 'kryptos@example.com',
  displayName: 'Kryptos',
  role: 'USER',
  avatarUrl: null,
  instagram: 'kryptos',
  showProfilePublic: true,
  loginCount: 3,
  whatsapp: '+393331234567',
  whatsappVisibility: 'NOBODY',
  birthDate: '1993-04-12',
  gender: 'MALE',
  danceRole: 'LEADER',
  danceStyles: [{ danceStyleId: 1, name: 'Salsa', slug: 'salsa', level: 'ADVANCED' }],
};

describe('profileFormValue', () => {
  it('fills the form with the user as the backend has them', () => {
    expect(profileFormValue(user)).toEqual({
      instagram: 'kryptos',
      showProfilePublic: true,
      whatsapp: '+393331234567',
      whatsappVisible: false,
      birthDate: '1993-04-12',
      gender: 'MALE',
      danceRole: 'LEADER',
      danceStyles: [{ danceStyleId: 1, level: 'ADVANCED' }],
    });
  });

  it('copes with a user stored before the dancer\'s profile existed', () => {
    const old = { ...user } as Partial<UserDto>;
    delete old.whatsapp;
    delete old.whatsappVisibility;
    delete old.birthDate;
    delete old.gender;
    delete old.danceRole;
    delete old.danceStyles;
    expect(profileFormValue(old as UserDto)).toMatchObject({
      whatsapp: '',
      whatsappVisible: true,
      birthDate: '',
      gender: null,
      danceRole: null,
      danceStyles: [],
    });
  });
});

describe('toUserUpdate', () => {
  const form: ProfileFormValue = {
    instagram: '@kryptos',
    showProfilePublic: true,
    whatsapp: '333 123 4567',
    whatsappVisible: true,
    birthDate: '1993-04-12',
    gender: 'MALE',
    danceRole: 'BOTH',
    danceStyles: [{ danceStyleId: 2, level: 'BEGINNER' }],
  };

  it('sends every field, normalized the way the backend stores them', () => {
    expect(toUserUpdate(form)).toEqual({
      instagram: 'kryptos',
      showProfilePublic: true,
      whatsapp: '+393331234567',
      whatsappVisibility: 'EVERYONE',
      birthDate: '1993-04-12',
      gender: 'MALE',
      danceRole: 'BOTH',
      danceStyles: [{ danceStyleId: 2, level: 'BEGINNER' }],
    });
  });

  it('sends what was emptied as null, and a hidden WhatsApp as NOBODY', () => {
    const update = toUserUpdate({ ...form, whatsapp: '  ', whatsappVisible: false, birthDate: '', danceStyles: [] });
    expect(update.whatsapp).toBeNull();
    expect(update.whatsappVisibility).toBe('NOBODY');
    expect(update.birthDate).toBeNull();
    expect(update.danceStyles).toEqual([]);
  });

  it('saves back unchanged what the form was filled with', () => {
    const { danceStyles, ...rest } = toUserUpdate(profileFormValue(user));
    expect(rest).toEqual({
      instagram: 'kryptos',
      showProfilePublic: true,
      whatsapp: '+393331234567',
      whatsappVisibility: 'NOBODY',
      birthDate: '1993-04-12',
      gender: 'MALE',
      danceRole: 'LEADER',
    });
    expect(danceStyles).toEqual([{ danceStyleId: 1, level: 'ADVANCED' }]);
  });
});

describe('sameProfile', () => {
  const saved = profileFormValue(user);

  it('sees no change in a field changed and put back', () => {
    expect(sameProfile({ ...saved, gender: 'FEMALE' }, saved)).toBe(false);
    expect(sameProfile({ ...saved, gender: 'MALE' }, saved)).toBe(true);
  });

  it('sees no change in the same number or handle written another way', () => {
    expect(sameProfile({ ...saved, whatsapp: '333 123 4567', instagram: '@kryptos' }, saved)).toBe(true);
  });

  it('sees no change in the same styles picked in another order, but sees a new level', () => {
    const two = { ...saved, danceStyles: [{ danceStyleId: 1, level: 'ADVANCED' as const }, { danceStyleId: 2, level: 'BEGINNER' as const }] };
    const reversed = { ...two, danceStyles: [...two.danceStyles].reverse() };
    expect(sameProfile(reversed, two)).toBe(true);
    expect(sameProfile({ ...two, danceStyles: [{ danceStyleId: 1, level: 'TEACHER' }, two.danceStyles[1]] }, two)).toBe(false);
  });
});
