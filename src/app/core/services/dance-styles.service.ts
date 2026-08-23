import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { DanceStyleDto } from '../models/dance-style.model';

@Injectable({ providedIn: 'root' })
export class DanceStylesService {
  private readonly http = inject(HttpClient);

  getDanceStyles() {
    return this.http.get<DanceStyleDto[]>(`${environment.apiUrl}/rest/dance-styles`);
  }
}
