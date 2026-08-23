import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CityDto } from '../models/city.model';

@Injectable({ providedIn: 'root' })
export class CitiesService {
  private readonly http = inject(HttpClient);

  getCities() {
    return this.http.get<CityDto[]>(`${environment.apiUrl}/rest/cities`);
  }
}
