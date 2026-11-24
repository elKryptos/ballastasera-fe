import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { cursorParams } from '../api/cursor-params';
import { endpoints } from '../api/endpoints';
import { CursorPage, PageCursor } from '../models/page.model';
import { ReportDto, UserSummaryDto } from '../models/social.model';

/** People per page in the friends' lists (the backend allows up to 50). */
const PEOPLE_PAGE_SIZE = 20;

/** Which of the viewer's lists: who follows them, whom they follow, the friends (both). */
export type PeopleList = 'followers' | 'following' | 'friends';

const LIST_PATHS: Record<PeopleList, string> = {
  followers: endpoints.users.myFollowers,
  following: endpoints.users.myFollowing,
  friends: endpoints.users.myFriends,
};

/**
 * Following, muting, blocking and reporting, and the viewer's lists of people. Following is open
 * (no request to accept); friends are two people who follow each other. All idempotent on the
 * backend: a tap repeated by a slow network does no harm. The own profile's numbers come from
 * /auth/me, which "Il tuo profilo" asks again each time it opens.
 */
@Service()
export class FollowsService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /** 404 when their profile is private, there's a block, or they're gone; 400 SELF_ACTION for oneself. */
  follow(userId: string): Observable<void> {
    return this.http.post<void>(`${this.api}${endpoints.users.follow(userId)}`, {});
  }

  /** Always allowed, also when they turned private since (they can't be followed again until public). */
  unfollow(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.api}${endpoints.users.follow(userId)}`);
  }

  /** "Silenzia": out of the viewer's feed and bell, without them knowing. Only someone followed. */
  setMuted(userId: string, muted: boolean): Observable<void> {
    return this.http.patch<void>(`${this.api}${endpoints.users.follow(userId)}`, { muted });
  }

  /** Both stop following each other and neither sees the other any more. */
  block(userId: string): Observable<void> {
    return this.http.post<void>(`${this.api}${endpoints.users.block(userId)}`, {});
  }

  /** The follows the block deleted don't come back. */
  unblock(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.api}${endpoints.users.block(userId)}`);
  }

  /** To the admin's queue; nothing is hidden by it alone. One open report per pair. */
  report(userId: string, report: ReportDto): Observable<void> {
    return this.http.post<void>(`${this.api}${endpoints.users.report(userId)}`, report);
  }

  /** One page of a list, newest first. `query` (friends only) looks in the names. */
  list(kind: PeopleList, cursor: PageCursor | null, query = ''): Observable<CursorPage<UserSummaryDto>> {
    let params = new HttpParams();
    if (kind === 'friends' && query.trim()) params = params.set('q', query.trim());
    return this.http.get<CursorPage<UserSummaryDto>>(`${this.api}${LIST_PATHS[kind]}`, {
      params: cursorParams(cursor, PEOPLE_PAGE_SIZE, params),
    });
  }

  /** Everyone the viewer blocked, all at once (a short list). */
  blocks(): Observable<UserSummaryDto[]> {
    return this.http.get<UserSummaryDto[]>(`${this.api}${endpoints.users.myBlocks}`);
  }
}
