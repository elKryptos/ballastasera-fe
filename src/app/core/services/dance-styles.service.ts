import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { DanceStyleDto } from '../models/dance-style.model';
import { Observable } from 'rxjs';
import { endpoints } from '../api/endpoints';

@Injectable({ providedIn: 'root' })
export class DanceStylesService {
  private readonly http = inject(HttpClient);

  getDanceStyles(): Observable<DanceStyleDto[]> {
    return this.http.get<DanceStyleDto[]>(`${environment.apiUrl}${endpoints.danceStyles.list}`);
  }
}
