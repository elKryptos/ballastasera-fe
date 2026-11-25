import { ReportReason } from './social.model';

/** Mirrors ReportStatus: the admin's queue tabs. OPEN to review, DISMISSED ("Ignora") and BANNED
 * ("Banna", which closes every open report against the same person). */
export type ReportStatus = 'OPEN' | 'DISMISSED' | 'BANNED';

/** One report in the admin's queue (GET /admin/reports). */
export interface UserReportAdminDto {
  id: string;
  reason: ReportReason;
  note: string | null;
  status: ReportStatus;
  createdAt: string;
  reporterId: string;
  reporterName: string;
  reporterAvatarUrl: string | null;
  reportedId: string;
  reportedName: string;
  reportedAvatarUrl: string | null;
  reportedEmail: string;
  reportedBanned: boolean;
  /** How many reports against the same person are still open, this one included. */
  openReportsAgainst: number;
  reviewedByName: string | null;
  reviewedAt: string | null;
}

/** "Utenti bannati" (GET /admin/users/banned). bannedAt is null for bans older than the reports. */
export interface BannedUserAdminDto {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  email: string;
  bannedAt: string | null;
}
