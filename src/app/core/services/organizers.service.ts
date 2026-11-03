import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';
import { endpoints } from '../api/endpoints';
import { publicApi } from '../interceptors/auth.interceptor';
import { OrganizerDetailDto, OrganizerSummaryDto } from '../models/organizer.model';
import { VenuesSummaryDto } from '../models/venue.model';

@Service()
export class OrganizersService {
  private readonly http = inject(HttpClient);

  /** Verified organizers nobody owns yet, by name. The backend wants at least 3 characters. */
  getClaimable(name: string, limit = 5): Observable<OrganizerSummaryDto[]> {
    const params = new HttpParams().set('name', name).set('limit', limit);
    return this.http.get<OrganizerSummaryDto[]>(`${environment.apiUrl}${endpoints.organizers.claimable}`, { params, context: publicApi() });
  }

  getBySlug(slug: string): Observable<OrganizerDetailDto> {
    return this.http.get<OrganizerDetailDto>(`${environment.apiUrl}${endpoints.organizers.getBySlug(slug)}`, { context: publicApi() });
  }

  getVenues(id: string): Observable<VenuesSummaryDto[]> {
    return this.http.get<VenuesSummaryDto[]>(`${environment.apiUrl}${endpoints.organizers.venues(id)}`, { context: publicApi() });
  }

  /** The organizers the signed-in user owns: at most one for now (MAX_ORGANIZERS_PER_USER in the backend). */
  getMyOrganizers(): Observable<OrganizerDetailDto[]> {
    return this.http.get<OrganizerDetailDto[]>(`${environment.apiUrl}${endpoints.organizers.myOrganizers}`);
  }

  /** An organizer's page and its venues, for whoever shows them together. */
  getWithVenues(organizer: { id: string; slug: string }): Observable<{ detail: OrganizerDetailDto; venues: VenuesSummaryDto[] }> {
    return forkJoin({ detail: this.getBySlug(organizer.slug), venues: this.getVenues(organizer.id) });
  }
}
