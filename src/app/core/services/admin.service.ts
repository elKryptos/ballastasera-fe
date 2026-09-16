import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';
import { OrganizerCreateDto, OrganizerDetailDto, OrganizerSummaryDto, OrganizerUpdateDto } from '../models/organizer.model';
import { PageDto, SpringPage } from '../models/page.model';
import { environment } from '../../../environments/environment';
import { endpoints } from '../api/endpoints';
import { EventCreateDto, EventDetailDto } from '../models/event.model';

@Service()
export class AdminService {
  private readonly http = inject(HttpClient);

  getPendingOrganizer(page = 0, size = 20): Observable<PageDto<OrganizerDetailDto>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageDto<OrganizerDetailDto>>(`${environment.apiUrl}${endpoints.admin.getPendingOrganizers}`, { params })
  }

  verifyOrganizer(id: string): Observable<OrganizerDetailDto> {
    return this.http.patch<OrganizerDetailDto>(`${environment.apiUrl}${endpoints.admin.verifyOrganizer(id)}`, {})
  }

  createUnclaimedOrganizer(body: OrganizerCreateDto): Observable<OrganizerCreateDto> {
    return this.http.post<OrganizerCreateDto>(`${environment.apiUrl}${endpoints.admin.createUnclaimedOrganizer}`, body);
  }

  getVerifiedOrganizers(page = 0, size = 20): Observable<SpringPage<OrganizerSummaryDto>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<SpringPage<OrganizerSummaryDto>>(`${environment.apiUrl}${endpoints.admin.getVerifiedOrganizers}`, { params });
  }

  deleteOrganizer(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}${endpoints.admin.deleteOrganizer(id)}`);
  }

  getOrganizer(id: string): Observable<OrganizerDetailDto> {
    return this.http.get<OrganizerDetailDto>(`${environment.apiUrl}${endpoints.admin.getOrganizer(id)}`);
  }

  updateOrganizer(id: string, body: OrganizerUpdateDto): Observable<OrganizerDetailDto> {
    return this.http.patch<OrganizerDetailDto>(`${environment.apiUrl}${endpoints.admin.updateOrganizer(id)}`, body);
  }

  createEvent(body: EventCreateDto): Observable<EventDetailDto> {
    return this.http.post<EventDetailDto>(`${environment.apiUrl}${endpoints.admin.createEvent}`, body);
  }

  uploadEventFlyer(id: string, file: File): Observable<EventDetailDto> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.patch<EventDetailDto>(`${environment.apiUrl}${endpoints.admin.updateEventFlyer(id)}`, formData);
  }
}
