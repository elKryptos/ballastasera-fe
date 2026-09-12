export type UserRole = 'USER' | 'ORGANIZER' | 'ADMIN';

export interface UserDto {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
  avatarUrl: string | null;
  instagram: string | null;
  showProfilePublic: boolean;
  /**
   * Not sent by the backend yet — until it is, this is always `undefined`,
   * so every login is treated as "hasn't seen it" (see Oauth2Callback.postLoginUrl).
   * Once the backend adds the field, this starts working with no further
   * frontend change.
   */
  hasSeenWelcome?: boolean;
}
