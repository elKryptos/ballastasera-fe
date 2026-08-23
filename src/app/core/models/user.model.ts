export type UserRole = 'USER' | 'ORGANIZER' | 'ADMIN';

export interface UserDto {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
  avatarUrl: string | null;
  instagram: string | null;
  showProfilePublic: boolean;
}
