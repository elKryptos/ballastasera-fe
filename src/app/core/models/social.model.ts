import { CursorPage } from './page.model';

/** Mirrors the backend's social enums and DTOs (social-plan.md, API.md §4 from "Seguir y
 * bloquear"). The words the user reads for each enum are in core/config/social.ts. */

/** The viewer's side of a pair: NONE "Segui", FOLLOWING "Segui già", FOLLOWED_BY "Ricambia",
 * MUTUAL "Amici" (friends: both follow each other). */
export type SocialRelation = 'NONE' | 'FOLLOWING' | 'FOLLOWED_BY' | 'MUTUAL';

/** Someone in a list: followers, friends, blocks, "Avete in comune", the feed, the bell. */
export interface UserSummaryDto {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  relation: SocialRelation;
  /** false: a private profile. Listed, but without a link to it nor a way to follow them (both
   * would answer 404): the row says "Profilo privato". */
  profilePublic: boolean;
}

/** GET /events/{id}/attendance/me. */
export interface MyAttendanceDto {
  going: boolean;
  /** "Cerco qualcuno con cui ballare" at this night. */
  lookingForPartner: boolean;
}

export type ReportReason = 'FAKE_PROFILE' | 'HARASSMENT' | 'INAPPROPRIATE_PHOTO' | 'OTHER';

/** POST /users/{id}/report. The note is required with OTHER, 500 characters at most. */
export interface ReportDto {
  reason: ReportReason;
  note: string | null;
}

/** "Stasera escono" in the Amici tab: a night tonight and the people the viewer follows going. */
export interface FeedTonightDto {
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  eventStartAt: string;
  venueName: string | null;
  meGoing: boolean;
  people: UserSummaryDto[];
}

export type FeedNewsType = 'FOLLOWED_YOU' | 'GOING_TO';

/** "Novità": someone started following the viewer, or someone they follow is going to a night of
 * the next 7 days. The event's fields only with GOING_TO. */
export interface FeedNewsDto {
  type: FeedNewsType;
  at: string;
  user: UserSummaryDto;
  eventId: string | null;
  eventSlug: string | null;
  eventTitle: string | null;
  eventStartAt: string | null;
  meGoing: boolean;
}

/** GET /users/me/feed. */
export interface FeedDto {
  tonight: FeedTonightDto[];
  news: FeedNewsDto[];
}

/** "Scopri": someone the viewer may know. The night is the nearest they share (preferring one
 * where they're looking for a partner), null when they share none: the "why" is built from these. */
export interface SuggestionDto {
  user: UserSummaryDto;
  mutualFriendsCount: number;
  eventId: string | null;
  eventSlug: string | null;
  eventTitle: string | null;
  eventStartAt: string | null;
  lookingForPartner: boolean;
}

export type NotificationType = 'NEW_FOLLOWER' | 'NEW_FRIEND' | 'INVITE';

/** The fixed phrases of an invite: no free text, so nothing to moderate. */
export type InvitePhrase = 'CI_VIENI' | 'ANDIAMO_INSIEME' | 'MI_ACCOMPAGNI' | 'TI_VA_DI_BALLARE';

/** One of the bell's notices. The event's fields and the phrase only with INVITE. actor.relation is
 * today's: once followed back, no more "Ricambia". */
export interface NotificationDto {
  id: string;
  type: NotificationType;
  createdAt: string;
  read: boolean;
  actor: UserSummaryDto;
  eventId: string | null;
  eventSlug: string | null;
  eventTitle: string | null;
  eventStartAt: string | null;
  phrase: InvitePhrase | null;
}

export interface UnreadCountDto {
  unread: number;
}

/** A friend in the "Invita a ballare" dialog: whether they can be invited to this night. */
export type InviteFriendStatus = 'INVITABLE' | 'ALREADY_GOING' | 'ALREADY_INVITED' | 'PRIVATE';

export interface InviteFriendDto {
  user: UserSummaryDto;
  status: InviteFriendStatus;
}

/** POST /users/{id}/invites. */
export interface InviteDto {
  eventId: string;
  phrase: InvitePhrase;
}

export type UsernameProblem = 'INVALID' | 'RESERVED' | 'TAKEN';

/** GET /users/username-available: one's own counts as available. */
export interface UsernameAvailabilityDto {
  available: boolean;
  reason: UsernameProblem | null;
}

/** GET /events/{id}/invites/friends: the invite dialog's friends, and how many invites are left today. */
export interface InviteFriendsDto {
  invitesLeft: number;
  friends: CursorPage<InviteFriendDto>;
}
