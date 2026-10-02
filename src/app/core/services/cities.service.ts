import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CityDto } from '../models/city.model';
import { Observable, shareReplay } from 'rxjs';
import { endpoints } from '../api/endpoints';

@Service()
export class CitiesService {
  private readonly http = inject(HttpClient);

  /** Asked once per visit and shared: the map, the list and the admin forms
   * all need it, and the active cities don't change while someone browses.
   * A failed request isn't kept (shareReplay resets on error), so the next
   * caller retries. */
  private readonly cities$ = this.http
    .get<CityDto[]>(`${environment.apiUrl}${endpoints.cities.list}`)
    .pipe(shareReplay(1));

  getCities(): Observable<CityDto[]> {
    return this.cities$;
  }
}
