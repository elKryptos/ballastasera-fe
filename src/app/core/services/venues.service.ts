import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { environment } from '@env/environment';
import { VenuesSummaryDto } from '@/core/models/venue.model';
import { Observable } from 'rxjs';
import { endpoints } from '@/core/api/endpoints';

@Service()
export class VenuesService {
  private readonly http = inject(HttpClient);

  /** Venues of a city, as returned by GET /rest/venues?cityId={id}. */
  listByCity(cityId: number): Observable<VenuesSummaryDto[]> {
    const params = new HttpParams().set('cityId', cityId);
    return this.http.get<VenuesSummaryDto[]>(`${environment.apiUrl}${endpoints.venues.list}`, { params });
  }
}
