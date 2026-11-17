import { ContactVisibility, DanceRole, Gender, UserDanceStyleUpdateDto, UserDto, UserUpdateDto } from '../models/user.model';
import { instagramHandle } from './event-format';
import { normalizeWhatsapp } from './whatsapp';

/** The account's form, as the user fills it in: text the way it was typed, the
 * WhatsApp's visibility as a switch, empty strings for nothing. */
export interface ProfileFormValue {
  instagram: string;
  showProfilePublic: boolean;
  whatsapp: string;
  whatsappVisible: boolean;
  /** yyyy-MM-dd, as a date input gives it; '' when not given. */
  birthDate: string;
  gender: Gender | null;
  danceRole: DanceRole | null;
  danceStyles: UserDanceStyleUpdateDto[];
}

/** The form filled in with the user as the backend has them. Every field has a fallback:
 * the user kept in localStorage from before the dancer's profile has none of them. */
export function profileFormValue(user: UserDto): ProfileFormValue {
  return {
    instagram: user.instagram ?? '',
    showProfilePublic: user.showProfilePublic,
    whatsapp: user.whatsapp ?? '',
    whatsappVisible: user.whatsappVisibility !== 'NOBODY',
    birthDate: user.birthDate ?? '',
    gender: user.gender ?? null,
    danceRole: user.danceRole ?? null,
    danceStyles: (user.danceStyles ?? []).map(({ danceStyleId, level }) => ({ danceStyleId, level })),
  };
}

/** Whether two fillings of the form would save the same profile: compared as they'd be sent
 * (toUserUpdate), so "333 123 4567" and "+393331234567", or "@name" and "name", are the same,
 * and the styles whatever order they were picked in. The account's "Salva" and "Annulla" show
 * only when the form differs from what was last saved. */
export function sameProfile(a: ProfileFormValue, b: ProfileFormValue): boolean {
  return JSON.stringify(comparable(a)) === JSON.stringify(comparable(b));
}

function comparable(value: ProfileFormValue): UserUpdateDto {
  const update = toUserUpdate(value);
  return { ...update, danceStyles: [...update.danceStyles].sort((x, y) => x.danceStyleId - y.danceStyleId) };
}

/** The PATCH /auth/me body. The backend replaces the whole profile with it (a field left
 * out is saved as null), so it carries every field, also those the page doesn't show while
 * the dancerProfile flag is off: the form holds them with the user's values all the same. */
export function toUserUpdate(value: ProfileFormValue): UserUpdateDto {
  const visibility: ContactVisibility = value.whatsappVisible ? 'EVERYONE' : 'NOBODY';
  return {
    instagram: instagramHandle(value.instagram),
    showProfilePublic: value.showProfilePublic,
    whatsapp: normalizeWhatsapp(value.whatsapp) || null,
    whatsappVisibility: visibility,
    birthDate: value.birthDate || null,
    gender: value.gender,
    danceRole: value.danceRole,
    danceStyles: value.danceStyles.map(({ danceStyleId, level }) => ({ danceStyleId, level })),
  };
}
