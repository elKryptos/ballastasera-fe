import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';
import { OrganizerDetailDto } from '../models/organizer.model';
import { PageDto } from '../models/page.model';
import { environment } from '../../../environments/environment';
import { endpoints } from '../api/endpoints';

@Service()
export class AdminService {
  private readonly http = inject(HttpClient);

  getPendingOrganizer(page = 0, size = 20): Observable<PageDto<OrganizerDetailDto>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageDto<OrganizerDetailDto>>(`${environment.apiUrl}${endpoints.admin.pendingOrganizers}`, { params })
  }

  verifyOrganizer(id: string): Observable<OrganizerDetailDto> {
    return this.http.patch<OrganizerDetailDto>(`${environment.apiUrl}${endpoints.admin.verifyOrganizer(id)}`, {})
  }
}
