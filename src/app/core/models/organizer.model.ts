export type OrganizerType = 'PERSON' | 'VENUE' | 'CLUB' | 'SCHOOL' | 'ASSOCIATION';

export interface OrganizerDetailDto {
  id: string;
  name: string;
  slug: string;
  type: OrganizerType;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  phone: string | null;
  contactEmail: string | null;
  instagram: string | null;
  facebook: string | null;
  verified: boolean;
  claimed: boolean;
}