import { SocialRelation, UserSummaryDto } from './social.model';

export type UserRole = 'USER' | 'ORGANIZER' | 'ADMIN';

/** Mirrors the backend enums of the dancer's profile (Gender, DanceRole, DanceLevel,
 * ContactVisibility). The words the user reads are in core/config/dance-profile.ts. */
export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNDISCLOSED';
export type DanceRole = 'LEADER' | 'FOLLOWER' | 'BOTH';
export type DanceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'TEACHER';
/** Who sees the WhatsApp, and who sees the nights one goes to: everyone, only friends (both
 * follow each other) or nobody. The words are in core/config/social.ts. */
export type ContactVisibility = 'NOBODY' | 'EVERYONE' | 'MUTUALS';
/** Which photo shows: Google's, one the user uploaded, or none (the initial). */
export type AvatarSource = 'GOOGLE' | 'CUSTOM' | 'NONE';

/** A style the user dances, at their level: in /auth/me and in a public profile. */
export interface UserDanceStyleDto {
  danceStyleId: number;
  name: string;
  slug: string;
  level: DanceLevel;
}

/** Where the user lives, as Photon gave it (GeocodingService.searchCities): a comune, never an
 * address. Only its name ever shows to others, and only with showHomeCity. */
export interface HomeCityDto {
  name: string;
  region: string | null;
  /** ISO 3166-1 alpha-2, upper case. */
  country: string;
  latitude: number;
  longitude: number;
}

/** GET /auth/me: the signed-in user, everything about them. The fields added with the social
 * features may be missing from a user kept in localStorage from before: read them with a fallback. */
export interface UserDto {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
  /** The photo that shows (see avatarSource), or null: the initial. */
  avatarUrl: string | null;
  instagram: string | null;
  showProfilePublic: boolean;
  loginCount: number;
  /** E.164 (+393331234567). Only its owner sees it here; others see it in UserProfileDto if allowed. */
  whatsapp: string | null;
  whatsappVisibility: ContactVisibility;
  /** yyyy-MM-dd. Only its owner sees it: a public profile shows the age. */
  birthDate: string | null;
  gender: Gender | null;
  danceRole: DanceRole | null;
  danceStyles: UserDanceStyleDto[];
  /** Google's photo even while another shows: for "Usa la foto di Google". */
  googleAvatarUrl: string | null;
  avatarSource: AvatarSource;
  bio: string | null;
  attendanceVisibility: ContactVisibility;
  /** The school picked from the app's (a verified SCHOOL organizer), or null. */
  schoolOrganizerId: string | null;
  /** The linked school's name, or the one typed when it isn't in the app. */
  schoolName: string | null;
  /** The linked school's page (/organizzatore/{slug}); null for a typed one. */
  schoolSlug: string | null;
  /** ISO 3166-1 alpha-2. */
  originCountry: string | null;
  homeCity: HomeCityDto | null;
  showHomeCity: boolean;
  /** "Ricevi email": changed on its own (UsersService.setEmailNotifications), never by PATCH /auth/me. */
  emailNotifications: boolean;
  /** Changed on its own too (UsersService.setUsername). */
  username: string | null;
  memberSince: string | null;
  followersCount: number;
  followingCount: number;
  /** Nights over that they said "Ci vado" to. */
  eventsCount: number;
  /** Venues of those nights. */
  venuesCount: number;
  /** When the first of those nights was: only the user sees it. */
  firstEventAt: string | null;
}

/** One style picked in the account's form. */
export interface UserDanceStyleUpdateDto {
  danceStyleId: number;
  level: DanceLevel;
}

/** PATCH /rest/auth/me. It replaces the whole profile: a field left out is saved as null,
 * so the form always sends every field (see toUserUpdate). Name and email come from Google;
 * the photo, the username and "Ricevi email" have their own endpoints. */
export interface UserUpdateDto {
  instagram: string;
  showProfilePublic: boolean;
  whatsapp: string | null;
  whatsappVisibility: ContactVisibility;
  birthDate: string | null;
  gender: Gender | null;
  danceRole: DanceRole | null;
  danceStyles: UserDanceStyleUpdateDto[];
  bio: string | null;
  attendanceVisibility: ContactVisibility;
  schoolOrganizerId: string | null;
  /** Ignored by the backend when schoolOrganizerId is set. */
  schoolName: string | null;
  originCountry: string | null;
  homeCity: HomeCityDto | null;
  showHomeCity: boolean;
}

/** GET /rest/users/{id} and /users/by-username/{username}: someone's public profile, for
 * signed-in users only. The age instead of the birth date; whatsapp is null when its owner keeps
 * it from the viewer. 404 when it's private, blocked, banned or gone: the same 404 for all. */
export interface UserProfileDto {
  userId: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  instagram: string | null;
  age: number | null;
  gender: Gender | null;
  danceRole: DanceRole | null;
  whatsapp: string | null;
  danceStyles: UserDanceStyleDto[];
  bio: string | null;
  schoolOrganizerId: string | null;
  schoolName: string | null;
  schoolSlug: string | null;
  originCountry: string | null;
  /** Only the city's name, and only when its owner shows it. */
  homeCityName: string | null;
  /** The viewer's relation with this person: NONE on one's own profile. */
  relation: SocialRelation;
  /** The viewer muted them ("Silenzia"): only while following. */
  muted: boolean;
  followersCount: number;
  followingCount: number;
  eventsCount: number;
  venuesCount: number;
  memberSince: string | null;
  /** "Avete in comune": up to 3 friends both have, in alphabetical order, and how many in all. */
  mutualFriends: UserSummaryDto[];
  mutualFriendsCount: number;
  /** Nights over that both went to; 0 when the viewer can't see their nights. */
  eventsTogetherCount: number;
  lastEventTogetherId: string | null;
  lastEventTogetherTitle: string | null;
  lastEventTogetherStartAt: string | null;
  /** "Cerco qualcuno con cui ballare" at a night on now or in the next 24 hours. */
  lookingForPartnerToday: boolean;
}
