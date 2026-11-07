export type OrganizerType = 'PERSON' | 'VENUE' | 'CLUB' | 'SCHOOL';

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

/** PATCH /rest/organizers/{id}, by its owner: no type (the backend has none to change) and no logoUrl
 * (the owner uploads the logo: PATCH /rest/organizers/{id}/logo). The backend skips nulls, so an
 * emptied field goes as "". */
export type OrganizerOwnerUpdateDto = Omit<OrganizerUpdateDto, 'type' | 'logoUrl'>;

export interface OrganizerSummaryDto {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  instagram: string | null;
  whatsapp: string | null;
  type: OrganizerType;
  verified: boolean;
}

/** GET /rest/admin/organizers/verified: the admin list, with each page's owner (admin only, never public).
 * See organizerOwnership() for what claimed and ownerId mean together. */
export interface OrganizerAdminDto {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  instagram: string | null;
  type: OrganizerType;
  verified: boolean;
  claimed: boolean;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
}