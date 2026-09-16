import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { environment } from '@env/environment';
import {
  EventCardDto,
  EventCreateDto,
  EventDetailDto,
  EventStatus,
  EventStatusUpdateDto,
  OrganizerEventDetailDto,
} from '@/core/models/event.model';
import { Observable } from 'rxjs';
import { endpoints } from '@/core/api/endpoints';

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

  /** Full event payload — GET /rest/events/{id}. */
  getEventDetail(id: string): Observable<EventDetailDto> {
    return this.http.get<EventDetailDto>(`${environment.apiUrl}${endpoints.events.detail(id)}`);
  }

  /** Private owner payload for any event status — GET /rest/events/{id}/manage. */
  getManageableEventDetail(id: string): Observable<OrganizerEventDetailDto> {
    return this.http.get<OrganizerEventDetailDto>(
      `${environment.apiUrl}${endpoints.events.manage(id)}`,
    );
  }

  /** Creates a PENDING event — POST /rest/events. */
  createEvent(dto: EventCreateDto): Observable<OrganizerEventDetailDto> {
    return this.http.post<OrganizerEventDetailDto>(this.baseUrl, dto);
  }

  /** Publishes / cancels a PENDING event — PATCH /rest/events/{id}/status. */
  updateEventStatus(id: string, status: EventStatus): Observable<OrganizerEventDetailDto> {
    const body: EventStatusUpdateDto = { status };
    return this.http.patch<OrganizerEventDetailDto>(
      `${environment.apiUrl}${endpoints.events.updateStatus(id)}`,
      body,
    );
  }

  /**
   * Uploads the event flyer — PATCH /rest/events/{id}/flyer, multipart with the
   * "file" field. No Content-Type is set by hand: the browser must add the
   * boundary, and the backend CORS only allows PATCH with Authorization/Content-Type.
   */
  updateFlyer(id: string, file: File): Observable<OrganizerEventDetailDto> {
    const form = new FormData();
    form.set('file', file);
    return this.http.patch<OrganizerEventDetailDto>(
      `${environment.apiUrl}${endpoints.events.updateFlyer(id)}`,
      form,
    );
  }

  /** Deletes the event — DELETE /rest/events/{id}. Used by "Annulla" in stage 2. */
  deleteEvent(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}${endpoints.events.delete(id)}`);
  }
}
