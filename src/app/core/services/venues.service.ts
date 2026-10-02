import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { endpoints } from '../api/endpoints';
import { VenueDetailDto, VenueMapPinDto, VenuesSummaryDto } from '../models/venue.model';

@Service()
export class VenuesService {
  private readonly http = inject(HttpClient);

  getVenues(cityId: number, search?: string): Observable<VenuesSummaryDto[]> {
    let params = new HttpParams().set('cityId', cityId);
    if (search) {
      params = params.set('search', search)
    }
    return this.http.get<VenuesSummaryDto[]>(`${environment.apiUrl}${endpoints.venues.list}`, {params});
  }

  /** Every venue of a city, for the map's places layer. */
  getMapVenues(cityId: number): Observable<VenueMapPinDto[]> {
    const params = new HttpParams().set('cityId', cityId);
    return this.http.get<VenueMapPinDto[]>(`${environment.apiUrl}${endpoints.venues.map}`, { params });
  }

  /** Everything about one venue, for its page (/luogo/:id). */
  getVenueDetail(id: string): Observable<VenueDetailDto> {
    return this.http.get<VenueDetailDto>(`${environment.apiUrl}${endpoints.venues.detail(id)}`);
  }
}
