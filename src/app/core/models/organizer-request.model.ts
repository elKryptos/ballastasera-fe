import { OrganizerSummaryDto, OrganizerType } from './organizer.model';
import { VenuesSummaryDto } from './venue.model';

export type OrganizerRequestType = 'NEW' | 'CLAIM';
export type OrganizerRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type OrganizerRejectReason =
  | 'INSTAGRAM_NOT_FOUND'
  | 'INCOMPLETE_DATA'
  | 'NOT_DANCE_ORGANIZER'
  | 'DUPLICATE'
  | 'OTHER';

/** Body of POST /rest/organizer-requests. CLAIM takes targetOrganizerId and the
 * proof (instagram, contactEmail, message); NEW takes the whole proposed profile. */
export interface OrganizerRequestCreateDto {
  type: OrganizerRequestType;
  targetOrganizerId?: string;
  name?: string;
  organizerType?: OrganizerType;
  description?: string;
  instagram: string;
  contactEmail: string;
  phone?: string;
  website?: string;
  facebook?: string;
  message?: string;
  venueAddress?: string;
  venueCityId?: number;
  termsAccepted: boolean;
}

/** A request as its author sees it. */
export interface OrganizerRequestDto {
  id: string;
  type: OrganizerRequestType;
  status: OrganizerRequestStatus;
  organizerName: string;
  organizerType: OrganizerType | null;
  organizerId: string | null;
  organizerSlug: string | null;
  description: string | null;
  logoUrl: string | null;
  instagram: string;
  contactEmail: string;
  phone: string | null;
  website: string | null;
  facebook: string | null;
  message: string | null;
  venueAddress: string | null;
  venueCityName: string | null;
  venueId: string | null;
  venueName: string | null;
  rejectionReason: OrganizerRejectReason | null;
  rejectionMessage: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  acknowledgedAt: string | null;
}

export interface RequesterDto {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  instagram: string | null;
  memberSince: string;
}

/** A request as the admin sees it: who asked, who reviewed, and what to decide with. */
export interface OrganizerRequestAdminDto extends OrganizerRequestDto {
  requester: RequesterDto;
  /** CLAIM only. */
  targetOrganizer: OrganizerSummaryDto | null;
  /** CLAIM only: the venues the page already has. Empty on a NEW. */
  targetOrganizerVenues: VenuesSummaryDto[];
  reviewedByName: string | null;
  /** How many times this user was rejected before: 1 or more reads "2º intento". */
  previousRejections: number;
}

export interface OrganizerRequestRejectDto {
  reason: OrganizerRejectReason;
  /** Required when reason is OTHER. */
  message?: string;
}

export interface OrganizerRequestApproveDto {
  /** The venue the admin just created for this request, if any. */
  venueId?: string;
}
