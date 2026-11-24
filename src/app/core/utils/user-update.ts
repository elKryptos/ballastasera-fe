import {
  ContactVisibility,
  DanceRole,
  Gender,
  HomeCityDto,
  UserDanceStyleUpdateDto,
  UserDto,
  UserUpdateDto,
} from '../models/user.model';
import { instagramHandle } from './event-format';
import { normalizeUsername } from './username';
import { normalizeWhatsapp } from './whatsapp';

/** "Scuola o crew" as picked: one of the app's schools (organizerId, its name to show) or a name
 * typed for one that isn't in the app (organizerId null). */
export interface SchoolPick {
  organizerId: string | null;
  name: string;
}

/** The account's form, as the user fills it in: text the way it was typed, empty strings for
 * nothing. Every field the backend's profile has, shown or not (see toUserUpdate). */
export interface ProfileFormValue {
  /** Saved with its own endpoint after the rest (UsersService.setUsername): not in toUserUpdate. */
  username: string;
  instagram: string;
  showProfilePublic: boolean;
  whatsapp: string;
  whatsappVisibility: ContactVisibility;
  /** yyyy-MM-dd, as a date input gives it; '' when not given. */
  birthDate: string;
  gender: Gender | null;
  danceRole: DanceRole | null;
  danceStyles: UserDanceStyleUpdateDto[];
  bio: string;
  attendanceVisibility: ContactVisibility;
  school: SchoolPick | null;
  /** ISO 3166-1 alpha-2. */
  originCountry: string | null;
  homeCity: HomeCityDto | null;
  showHomeCity: boolean;
}

/** The form filled in with the user as the backend has them. Every field has a fallback: a user
 * kept in localStorage from before the dancer's profile, or before the social features, lacks
 * them. The fallbacks are the backend's own defaults. */
export function profileFormValue(user: UserDto): ProfileFormValue {
  return {
    username: user.username ?? '',
    instagram: user.instagram ?? '',
    showProfilePublic: user.showProfilePublic,
    whatsapp: user.whatsapp ?? '',
    whatsappVisibility: user.whatsappVisibility ?? 'MUTUALS',
    birthDate: user.birthDate ?? '',
    gender: user.gender ?? null,
    danceRole: user.danceRole ?? null,
    danceStyles: (user.danceStyles ?? []).map(({ danceStyleId, level }) => ({ danceStyleId, level })),
    bio: user.bio ?? '',
    attendanceVisibility: user.attendanceVisibility ?? 'EVERYONE',
    school: schoolOf(user),
    originCountry: user.originCountry ?? null,
    homeCity: user.homeCity ?? null,
    showHomeCity: user.showHomeCity ?? false,
  };
}

function schoolOf(user: UserDto): SchoolPick | null {
  if (user.schoolOrganizerId) return { organizerId: user.schoolOrganizerId, name: user.schoolName ?? '' };
  return user.schoolName ? { organizerId: null, name: user.schoolName } : null;
}

/** Whether two fillings of the form would save the same profile: compared as they'd be sent
 * (toUserUpdate), so "333 123 4567" and "+393331234567", or "@name" and "name", are the same,
 * and the styles whatever order they were picked in. The account's "Salva" and "Annulla" show
 * only when the form differs from what was last saved. */
export function sameProfile(a: ProfileFormValue, b: ProfileFormValue): boolean {
  return JSON.stringify(comparable(a)) === JSON.stringify(comparable(b));
}

function comparable(value: ProfileFormValue): UserUpdateDto & { username: string } {
  const update = toUserUpdate(value);
  return {
    ...update,
    danceStyles: [...update.danceStyles].sort((x, y) => x.danceStyleId - y.danceStyleId),
    username: normalizeUsername(value.username),
  };
}

/** The PATCH /auth/me body. The backend replaces the whole profile with it (a field left out is
 * saved as null), so it carries every field, also those the page doesn't show while the
 * dancerProfile or social flags are off: the form holds them with the user's values all the same.
 * Not the username, which has its own endpoint. */
export function toUserUpdate(value: ProfileFormValue): UserUpdateDto {
  const school = value.school;
  return {
    instagram: instagramHandle(value.instagram),
    showProfilePublic: value.showProfilePublic,
    whatsapp: normalizeWhatsapp(value.whatsapp) || null,
    whatsappVisibility: value.whatsappVisibility,
    birthDate: value.birthDate || null,
    gender: value.gender,
    danceRole: value.danceRole,
    danceStyles: value.danceStyles.map(({ danceStyleId, level }) => ({ danceStyleId, level })),
    bio: value.bio.trim() || null,
    attendanceVisibility: value.attendanceVisibility,
    schoolOrganizerId: school?.organizerId ?? null,
    // The backend ignores the name of a linked school: sent only for one typed by hand.
    schoolName: school && !school.organizerId ? school.name.trim() || null : null,
    originCountry: value.originCountry,
    homeCity: value.homeCity,
    showHomeCity: value.homeCity ? value.showHomeCity : false,
  };
}
