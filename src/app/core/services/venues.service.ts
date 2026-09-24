import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { endpoints } from '../api/endpoints';
import { VenuesSummaryDto } from '../models/venue.model';

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
}
