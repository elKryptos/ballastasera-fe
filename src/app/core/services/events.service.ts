import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { EventAttendeeDto, EventDetailDto, MapEventsDto } from '../models/event.model';
import { SpringPage } from '../models/page.model';
import { MyAttendanceDto, UserSummaryDto } from '../models/social.model';
import { Observable } from 'rxjs';
import { endpoints } from '../api/endpoints';
import { publicApi } from '../interceptors/auth.interceptor';

export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

@Service()
export class EventsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}${endpoints.events.mapEvents}`;

  /** Published events, live or upcoming, inside the visible map bounding box. */
  getMapEvents(bounds: MapBounds, cityId?: number): Observable<MapEventsDto> {
    let params = new HttpParams()
      .set('minLat', bounds.minLat)
      .set('maxLat', bounds.maxLat)
      .set('minLng', bounds.minLng)
      .set('maxLng', bounds.maxLng);

    if (cityId != null) params = params.set('cityId', cityId);

    return this.http.get<MapEventsDto>(this.baseUrl, { params, context: publicApi() });
  }

  getEventDetail(id: string): Observable<EventDetailDto> {
    return this.http.get<EventDetailDto>(`${environment.apiUrl}${endpoints.events.detail(id)}`, { context: publicApi() });
  }

  /** Who's going, public profiles only, `size` at a time (`page` counts from 0): the first
   * faces of "Chi ci va" on the event's page, and the whole list in its sheet. */
  getAttendees(eventId: string, size: number, page = 0): Observable<SpringPage<EventAttendeeDto>> {
    const params = new HttpParams().set('size', size).set('page', page);
    return this.http.get<SpringPage<EventAttendeeDto>>(`${environment.apiUrl}${endpoints.events.attendees(eventId)}`, {
      params,
      context: publicApi(),
    });
  }

  /** "Ci vado". With lookingForPartner (social), also sets or clears "Cerco qualcuno con cui ballare"
   * at this night; without it, that stays as it was. */
  addAttendance(eventId: string, lookingForPartner?: boolean): Observable<void> {
    const body = lookingForPartner === undefined ? {} : { lookingForPartner };
    return this.http.post<void>(`${environment.apiUrl}${endpoints.events.addAttendance(eventId)}`, body);
  }

  /** Whether the viewer is going, and looking for a partner there (social). */
  getMyAttendance(eventId: string): Observable<MyAttendanceDto> {
    return this.http.get<MyAttendanceDto>(`${environment.apiUrl}${endpoints.events.myAttendance(eventId)}`);
  }

  /** The viewer's friends going ("Sara e Luca ci vanno"), outside the event's cache: it's per viewer. */
  getFriendsGoing(eventId: string): Observable<UserSummaryDto[]> {
    return this.http.get<UserSummaryDto[]>(`${environment.apiUrl}${endpoints.events.friendsGoing(eventId)}`);
  }

  removeAttendance(eventId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}${endpoints.events.removeAttendance(eventId)}`);
  }

  isGoing(eventId: string): Observable<boolean> {
    return this.http.get<boolean>(`${environment.apiUrl}${endpoints.events.isGoing(eventId)}`)
  }

  /** "Mi piace" toggle. */
  addFavorite(eventId: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}${endpoints.events.addFavorite(eventId)}`, {});
  }

  removeFavorite(eventId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}${endpoints.events.removeFavorite(eventId)}`);
  }

  isFavorite(eventId: string): Observable<boolean> {
    return this.http.get<boolean>(`${environment.apiUrl}${endpoints.events.isFavorite(eventId)}`);
  }
}
