import { UserDto } from '../models/user.model';
import { ProfileFormValue, profileFormValue, sameProfile, toUserUpdate } from './user-update';

const milano = { name: 'Milano', region: 'Lombardia', country: 'IT', latitude: 45.46, longitude: 9.19 };

const user = {
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
  bio: 'Salsa dal 2019',
  attendanceVisibility: 'MUTUALS',
  schoolOrganizerId: null,
  schoolName: 'Crew del parco',
  schoolSlug: null,
  originCountry: 'CO',
  homeCity: milano,
  showHomeCity: true,
} as UserDto;

describe('profileFormValue', () => {
  it('fills the form with the user as the backend has them', () => {
    expect(profileFormValue(user)).toEqual({
      username: '',
      instagram: 'kryptos',
      showProfilePublic: true,
      whatsapp: '+393331234567',
      whatsappVisibility: 'NOBODY',
      birthDate: '1993-04-12',
      gender: 'MALE',
      danceRole: 'LEADER',
      danceStyles: [{ danceStyleId: 1, level: 'ADVANCED' }],
      bio: 'Salsa dal 2019',
      attendanceVisibility: 'MUTUALS',
      school: { organizerId: null, name: 'Crew del parco' },
      originCountry: 'CO',
      homeCity: milano,
      showHomeCity: true,
    });
  });

  it('copes with a user stored before the dancer\'s profile and the social features', () => {
    const old = { ...user } as Partial<UserDto>;
    for (const key of [
      'whatsapp', 'whatsappVisibility', 'birthDate', 'gender', 'danceRole', 'danceStyles', 'bio',
      'attendanceVisibility', 'schoolName', 'originCountry', 'homeCity', 'showHomeCity',
    ] as const) {
      delete old[key];
    }
    expect(profileFormValue(old as UserDto)).toMatchObject({
      whatsapp: '',
      whatsappVisibility: 'MUTUALS',
      birthDate: '',
      danceStyles: [],
      bio: '',
      attendanceVisibility: 'EVERYONE',
      school: null,
      originCountry: null,
      homeCity: null,
      showHomeCity: false,
    });
  });

  it('keeps a linked school by its id, with its name to show', () => {
    const linked = { ...user, schoolOrganizerId: 's1', schoolName: 'Accademia Salsa Isola' };
    expect(profileFormValue(linked).school).toEqual({ organizerId: 's1', name: 'Accademia Salsa Isola' });
  });
});

describe('toUserUpdate', () => {
  const form: ProfileFormValue = {
    username: 'kryptos',
    instagram: '@kryptos',
    showProfilePublic: true,
    whatsapp: '333 123 4567',
    whatsappVisibility: 'EVERYONE',
    birthDate: '1993-04-12',
    gender: 'MALE',
    danceRole: 'BOTH',
    danceStyles: [{ danceStyleId: 2, level: 'BEGINNER' }],
    bio: '  Bachata e salsa  ',
    attendanceVisibility: 'EVERYONE',
    school: { organizerId: 's1', name: 'Accademia Salsa Isola' },
    originCountry: 'VE',
    homeCity: milano,
    showHomeCity: true,
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
      bio: 'Bachata e salsa',
      attendanceVisibility: 'EVERYONE',
      schoolOrganizerId: 's1',
      schoolName: null,
      originCountry: 'VE',
      homeCity: milano,
      showHomeCity: true,
    });
  });

  it('sends what was emptied as null', () => {
    const update = toUserUpdate({ ...form, whatsapp: '  ', birthDate: '', danceStyles: [], bio: ' ', school: null });
    expect(update.whatsapp).toBeNull();
    expect(update.birthDate).toBeNull();
    expect(update.danceStyles).toEqual([]);
    expect(update.bio).toBeNull();
    expect(update.schoolOrganizerId).toBeNull();
    expect(update.schoolName).toBeNull();
  });

  it('sends a school typed by hand by its name, and never shows a city that\'s gone', () => {
    const update = toUserUpdate({ ...form, school: { organizerId: null, name: ' Crew ' }, homeCity: null });
    expect(update.schoolName).toBe('Crew');
    expect(update.showHomeCity).toBe(false);
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
      bio: 'Salsa dal 2019',
      attendanceVisibility: 'MUTUALS',
      schoolOrganizerId: null,
      schoolName: 'Crew del parco',
      originCountry: 'CO',
      homeCity: milano,
      showHomeCity: true,
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

  it('sees a new username, written any way', () => {
    expect(sameProfile({ ...saved, username: 'ana' }, saved)).toBe(false);
    expect(sameProfile({ ...saved, username: ' ' }, saved)).toBe(true);
  });

  it('sees no change in the same number, handle or bio written another way', () => {
    expect(sameProfile({ ...saved, whatsapp: '333 123 4567', instagram: '@kryptos', bio: 'Salsa dal 2019 ' }, saved)).toBe(true);
  });

  it('sees no change in the same styles picked in another order, but sees a new level', () => {
    const two = { ...saved, danceStyles: [{ danceStyleId: 1, level: 'ADVANCED' as const }, { danceStyleId: 2, level: 'BEGINNER' as const }] };
    const reversed = { ...two, danceStyles: [...two.danceStyles].reverse() };
    expect(sameProfile(reversed, two)).toBe(true);
    expect(sameProfile({ ...two, danceStyles: [{ danceStyleId: 1, level: 'TEACHER' }, two.danceStyles[1]] }, two)).toBe(false);
  });
});
