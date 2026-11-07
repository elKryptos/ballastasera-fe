export type UserRole = 'USER' | 'ORGANIZER' | 'ADMIN';

export interface UserDto {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
  avatarUrl: string | null;
  instagram: string | null;
  showProfilePublic: boolean;
  loginCount: number;
}

/** PATCH /rest/auth/me: the only two things a user changes about themselves. Name,
 * photo and email come from Google. */
export interface UserUpdateDto {
  instagram: string;
  showProfilePublic: boolean;
}
