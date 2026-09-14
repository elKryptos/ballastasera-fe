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

export interface OrganizerCreateDto {
  name: string;
  type: OrganizerType;
  description: string;
  logoUrl: string;
  website: string;
  phone: string;
  contactEmail: string;
  instagram: string;
  facebook: string;
}

export interface OrganizerUpdateDto {
  name: string;
  type: OrganizerType;
  description: string;
  logoUrl: string;
  website: string;
  phone: string;
  contactEmail: string;
  instagram: string;
  facebook: string;
}

export interface OrganizerSummaryDto {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  instagram: string | null;
  type: OrganizerType;
  verified: boolean;
}