import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '../../../environments/environment';
import { EMPTY, Observable, expand, reduce, take } from 'rxjs';
import { cursorParams } from '../api/cursor-params';
import { endpoints } from '../api/endpoints';
import { CursorPage, PageCursor } from '../models/page.model';
import { EventCardDto } from '../models/event.model';

/** Parteciperò or Mi piace — "Le tue serate"'s two tabs. */
export type MyNightsKind = 'going' | 'liked';

/** Each page of "Le tue serate"; the backend caps it at 50. */
const MY_NIGHTS_PAGE_SIZE = 20;

/** The upcoming nights one goes to, for their ids: the backend's biggest page, and at most this many
 * of them (250 nights), so a user with an endless list can't keep it asking. */
const GOING_IDS_PAGE_SIZE = 50;
const GOING_IDS_MAX_PAGES = 5;

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

  /** Ids of the nights the signed-in user goes to that aren't over: the list's ✓ buttons, in one
   * request for most (no ids endpoint for attendance, as there is for likes: the upcoming nights,
   * page after page). */
  getMyUpcomingGoingIds(): Observable<string[]> {
    const page = (cursor: PageCursor | null) =>
      this.http.get<CursorPage<EventCardDto>>(`${environment.apiUrl}${endpoints.users.myAttendance}`, {
        params: cursorParams(cursor, GOING_IDS_PAGE_SIZE, new HttpParams().set('past', false)),
      });
    return page(null).pipe(
      expand((answer) =>
        answer.nextCursorStartAt && answer.nextCursorId
          ? page({ startAt: answer.nextCursorStartAt, id: answer.nextCursorId })
          : EMPTY,
      ),
      take(GOING_IDS_MAX_PAGES),
      reduce((ids, answer) => [...ids, ...answer.items.map((event) => event.id)], [] as string[]),
    );
  }

  /** One page of Parteciperò ('going') or Mi piace ('liked'). Upcoming by
   * default, soonest first; past: the ones already over, latest first.
   * No cursor: the first page. */
  getMyNights(
    kind: MyNightsKind,
    past: boolean,
    cursor: PageCursor | null = null,
  ): Observable<CursorPage<EventCardDto>> {
    const params = cursorParams(cursor, MY_NIGHTS_PAGE_SIZE, new HttpParams().set('past', past));
    const path = kind === 'going' ? endpoints.users.myAttendance : endpoints.users.myFavorites;
    return this.http.get<CursorPage<EventCardDto>>(`${environment.apiUrl}${path}`, { params });
  }
}
