import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CityDto } from '../models/city.model';
import { Observable } from 'rxjs';
import { endpoints } from '../api/endpoints';

@Service()
export class CitiesService {
  private readonly http = inject(HttpClient);

  getCities(): Observable<CityDto[]> {
    return this.http.get<CityDto[]>(`${environment.apiUrl}${endpoints.cities.list}`);
  }
}
