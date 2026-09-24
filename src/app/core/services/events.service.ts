import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { EventCardDto, EventCreateDto, EventDetailDto, EventStatus, OrganizerEventDetailDto } from '../models/event.model';
import { Observable } from 'rxjs';
import { endpoints } from '../api/endpoints';

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
  getMapEvents(bounds: MapBounds, cityId?: number): Observable<EventCardDto[]> {
    let params = new HttpParams()
      .set('minLat', bounds.minLat)
      .set('maxLat', bounds.maxLat)
      .set('minLng', bounds.minLng)
      .set('maxLng', bounds.maxLng);

    if (cityId != null) params = params.set('cityId', cityId);

    return this.http.get<EventCardDto[]>(this.baseUrl, { params });
  }

  getEventDetail(id: string): Observable<EventDetailDto> {
    return this.http.get<EventDetailDto>(`${environment.apiUrl}${endpoints.events.detail(id)}`);
  }

  addAttendance(eventId: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}${endpoints.events.addAttendance(eventId)}`, {});
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

  /** Dettaglio privato dell'organizzatore (stato incluso), per la pagina di pubblicazione. */
  getManageableEventDetail(id: string): Observable<OrganizerEventDetailDto> {
    return this.http.get<OrganizerEventDetailDto>(`${environment.apiUrl}${endpoints.events.manage(id)}`);
  }

  /** Creazione evento come organizzatore: il backend lo nasce sempre PENDING. */
  createEvent(dto: EventCreateDto): Observable<OrganizerEventDetailDto> {
    return this.http.post<OrganizerEventDetailDto>(`${environment.apiUrl}${endpoints.events.create}`, dto);
  }

  updateEventStatus(id: string, status: EventStatus): Observable<OrganizerEventDetailDto> {
    return this.http.patch<OrganizerEventDetailDto>(`${environment.apiUrl}${endpoints.events.updateStatus(id)}`, {
      status,
    });
  }

  /** Upload flyer come multipart/form-data: nessun Content-Type manuale, lo imposta il browser col boundary. */
  updateFlyer(id: string, file: File): Observable<OrganizerEventDetailDto> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.patch<OrganizerEventDetailDto>(`${environment.apiUrl}${endpoints.events.updateFlyer(id)}`, formData);
  }

  deleteEvent(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}${endpoints.events.delete(id)}`);
  }
}
