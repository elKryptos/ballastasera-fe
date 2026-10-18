import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { endpoints } from '../api/endpoints';
import { CursorPage, PageCursor } from '../models/page.model';
import { EventCardDto } from '../models/event.model';

/** Parteciperò or Mi piace — "Le tue serate"'s two tabs. */
export type MyNightsKind = 'going' | 'liked';

/** Each page of "Le tue serate"; the backend caps it at 50. */
const MY_NIGHTS_PAGE_SIZE = 20;

/**
 * The signed-in user's own lists, under /rest/users/me — mirrors
 * UserActivityService in the backend. Toggling going/liked on an event stays
 * in EventsService (it's /rest/events/{id}/...). */
@Service()
export class UserActivityService {
  private readonly http = inject(HttpClient);

  /** Ids of every event the signed-in user liked, in one request. */
  getMyFavoritesIds(): Observable<string[]> {
    return this.http.get<string[]>(`${environment.apiUrl}${endpoints.users.myFavoritesIds}`);
  }

  /** One page of Parteciperò ('going') or Mi piace ('liked'). Upcoming by
   * default, soonest first; past: the ones already over, latest first.
   * No cursor: the first page. */
  getMyNights(
    kind: MyNightsKind,
    past: boolean,
    cursor: PageCursor | null = null,
  ): Observable<CursorPage<EventCardDto>> {
    let params = new HttpParams().set('past', past).set('limit', MY_NIGHTS_PAGE_SIZE);
    if (cursor) params = params.set('cursorStartAt', cursor.startAt).set('cursorId', cursor.id);
    const path = kind === 'going' ? endpoints.users.myAttendance : endpoints.users.myFavorites;
    return this.http.get<CursorPage<EventCardDto>>(`${environment.apiUrl}${path}`, { params });
  }
}
