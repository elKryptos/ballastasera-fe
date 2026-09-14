import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { environment } from '@env/environment';
import { OrganizerDetailDto } from '@/core/models/organizer.model';
import { Observable } from 'rxjs';
import { endpoints } from '@/core/api/endpoints';

@Service()
export class OrganizersService {
  private readonly http = inject(HttpClient);

  /** Organizers owned by the current user, as returned by GET /rest/organizers/me. */
  getMyOrganizers(): Observable<OrganizerDetailDto[]> {
    return this.http.get<OrganizerDetailDto[]>(`${environment.apiUrl}${endpoints.organizers.myOrganizers}`);
  }
}
