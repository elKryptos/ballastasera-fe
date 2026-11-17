export type UserRole = 'USER' | 'ORGANIZER' | 'ADMIN';

/** Mirrors the backend enums of the dancer's profile (Gender, DanceRole, DanceLevel,
 * ContactVisibility). The words the user reads are in core/config/dance-profile.ts. */
export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNDISCLOSED';
export type DanceRole = 'LEADER' | 'FOLLOWER' | 'BOTH';
export type DanceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'TEACHER';
export type ContactVisibility = 'NOBODY' | 'EVERYONE';

/** A style the user dances, at their level: in /auth/me and in a public profile. */
export interface UserDanceStyleDto {
  danceStyleId: number;
  name: string;
  slug: string;
  level: DanceLevel;
}

export interface UserDto {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
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
}

/** One style picked in the account's form. */
export interface UserDanceStyleUpdateDto {
  danceStyleId: number;
  level: DanceLevel;
}

/** PATCH /rest/auth/me. It replaces the whole profile: a field left out is saved as null,
 * so the form always sends every field (see toUserUpdate). Name, photo and email come
 * from Google. */
export interface UserUpdateDto {
  instagram: string;
  showProfilePublic: boolean;
  whatsapp: string | null;
  whatsappVisibility: ContactVisibility;
  birthDate: string | null;
  gender: Gender | null;
  danceRole: DanceRole | null;
  danceStyles: UserDanceStyleUpdateDto[];
}

/** GET /rest/users/{id}: someone's public profile, for signed-in users only. The age
 * instead of the birth date; whatsapp is null when its owner keeps it hidden. */
export interface UserProfileDto {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  instagram: string | null;
  age: number | null;
  gender: Gender | null;
  danceRole: DanceRole | null;
  whatsapp: string | null;
  danceStyles: UserDanceStyleDto[];
}
