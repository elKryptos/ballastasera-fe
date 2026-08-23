import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { EventCardDto } from '../models/event.model';

export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

@Injectable({ providedIn: 'root' })
export class EventsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/rest/events`;

  /** Published events, live or upcoming, inside the visible map bounding box. */
  getMapEvents(bounds: MapBounds, cityId?: number) {
    let params = new HttpParams()
      .set('minLat', bounds.minLat)
      .set('maxLat', bounds.maxLat)
      .set('minLng', bounds.minLng)
      .set('maxLng', bounds.maxLng);

    if (cityId != null) params = params.set('cityId', cityId);

    return this.http.get<EventCardDto[]>(this.baseUrl, { params });
  }
}
