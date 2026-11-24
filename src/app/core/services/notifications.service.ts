import { HttpClient } from '@angular/common/http';
import { Service, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { cursorParams } from '../api/cursor-params';
import { endpoints } from '../api/endpoints';
import { CursorPage, PageCursor } from '../models/page.model';
import { NotificationDto, UnreadCountDto } from '../models/social.model';

/** Notices per page of /avvisi. */
const PAGE_SIZE = 20;

/**
 * The bell (social phase 6): the signed-in user's notices (a new follower, a new friend, an invite)
 * and how many are unread, the number on the bell. The count is kept here for the navbar to show;
 * watchUnreadNotifications asks for it. Opening the bell's page marks them all read at once.
 */
@Service()
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  private readonly unreadSignal = signal(0);
  readonly unread = this.unreadSignal.asReadonly();

  /** Newest first. Notices of muted people, banned ones and invites to nights over or cancelled are left out. */
  list(cursor: PageCursor | null): Observable<CursorPage<NotificationDto>> {
    return this.http.get<CursorPage<NotificationDto>>(`${this.api}${endpoints.users.myNotifications}`, {
      params: cursorParams(cursor, PAGE_SIZE),
    });
  }

  loadUnread(): Observable<UnreadCountDto> {
    return this.http
      .get<UnreadCountDto>(`${this.api}${endpoints.users.myUnreadCount}`)
      .pipe(tap(({ unread }) => this.unreadSignal.set(unread)));
  }

  /** Signed out: nothing to count. */
  clearUnread(): void {
    this.unreadSignal.set(0);
  }

  markAllRead(): Observable<void> {
    return this.http
      .patch<void>(`${this.api}${endpoints.users.myNotificationsRead}`, {})
      .pipe(tap(() => this.unreadSignal.set(0)));
  }
}
