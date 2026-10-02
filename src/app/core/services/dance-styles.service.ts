import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { DanceStyleDto } from '../models/dance-style.model';
import { Observable, shareReplay } from 'rxjs';
import { endpoints } from '../api/endpoints';

@Service()
export class DanceStylesService {
  private readonly http = inject(HttpClient);

  /** Asked once per visit and shared, same as CitiesService.getCities. */
  private readonly styles$ = this.http
    .get<DanceStyleDto[]>(`${environment.apiUrl}${endpoints.danceStyles.list}`)
    .pipe(shareReplay(1));

  getDanceStyles(): Observable<DanceStyleDto[]> {
    return this.styles$;
  }
}
