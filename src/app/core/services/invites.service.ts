import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { cursorParams } from '../api/cursor-params';
import { endpoints } from '../api/endpoints';
import { PageCursor } from '../models/page.model';
import { InviteDto, InviteFriendsDto } from '../models/social.model';

/** Friends per page in the invite dialog. */
const FRIENDS_PAGE_SIZE = 20;

/**
 * "Invita a ballare" (social phase 6): only friends, to a night not over that the viewer is going to,
 * with a fixed phrase. Ten a day; each friend once per night. The invited friend gets a notice (and
 * an email) and answers by saying "Ci vado" on the night's page: there's nothing to accept here.
 */
@Service()
export class InvitesService {
  private readonly http = inject(HttpClient);

  /** The friends with whether each can be invited to this night, and how many invites are left.
   * 400 PROFILE_PRIVATE / EVENT_NOT_INVITABLE / NOT_GOING when nobody can be invited to it. */
  friends(eventId: string, query: string, cursor: PageCursor | null): Observable<InviteFriendsDto> {
    let params = new HttpParams();
    if (query.trim()) params = params.set('q', query.trim());
    return this.http.get<InviteFriendsDto>(`${environment.apiUrl}${endpoints.events.inviteFriends(eventId)}`, {
      params: cursorParams(cursor, FRIENDS_PAGE_SIZE, params),
    });
  }

  /** Idempotent per friend and night. 429 INVITE_LIMIT past ten a day. */
  invite(userId: string, invite: InviteDto): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}${endpoints.users.invites(userId)}`, invite);
  }
}
