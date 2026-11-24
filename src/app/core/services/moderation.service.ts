import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { endpoints } from '../api/endpoints';
import { BannedUserAdminDto, ReportStatus, UserReportAdminDto } from '../models/moderation.model';
import { SpringPage } from '../models/page.model';

/** Reports and bans per page of the admin's lists (the backend allows 1–50). */
const PAGE_SIZE = 20;

/**
 * The admin's moderation (social phase 4): the reports' queue ("Ignora" closes one, "Banna" bans
 * the person and closes all their open ones), a ban without a report, and the banned with "Sbanna".
 * A ban ends the person's session at their next request; their follows stay, for an unban.
 */
@Service()
export class ModerationService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /** OPEN oldest first; DISMISSED and BANNED last reviewed first. */
  reports(status: ReportStatus, page: number): Observable<SpringPage<UserReportAdminDto>> {
    const params = new HttpParams().set('status', status).set('page', page).set('size', PAGE_SIZE);
    return this.http.get<SpringPage<UserReportAdminDto>>(`${this.api}${endpoints.admin.reports}`, { params });
  }

  /** 409 REPORT_NOT_OPEN (already reviewed), CANNOT_BAN_ADMIN, CONCURRENT_UPDATE. */
  review(reportId: string, status: Exclude<ReportStatus, 'OPEN'>): Observable<UserReportAdminDto> {
    return this.http.patch<UserReportAdminDto>(`${this.api}${endpoints.admin.reviewReport(reportId)}`, { status });
  }

  ban(userId: string): Observable<void> {
    return this.http.patch<void>(`${this.api}${endpoints.admin.banUser(userId)}`, {});
  }

  unban(userId: string): Observable<void> {
    return this.http.patch<void>(`${this.api}${endpoints.admin.unbanUser(userId)}`, {});
  }

  /** The last banned first. */
  banned(page: number): Observable<SpringPage<BannedUserAdminDto>> {
    const params = new HttpParams().set('page', page).set('size', PAGE_SIZE);
    return this.http.get<SpringPage<BannedUserAdminDto>>(`${this.api}${endpoints.admin.bannedUsers}`, { params });
  }
}
