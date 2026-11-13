import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { endpoints } from '../api/endpoints';
import {
  EventCardDto,
  EventCreateDto,
  EventDetailDto,
  EventManagementTab,
  EventStatus,
  EventUpdateDto,
} from '../models/event.model';
import { SpringPage } from '../models/page.model';
import { AdminService } from './admin.service';
import { EventsService } from './events.service';
import { OrganizersService } from './organizers.service';

/** Who manages the nights: the admin, any night, or the organizer, the nights of their own page. */
export type EventManagementScope = 'admin' | 'organizer';

/** The admin's list filters. The organizer's list is always their own nights. */
export interface ManagedEventsFilters {
  organizerId?: string | null;
  /** Part of the title. */
  search?: string | null;
}

/**
 * The nights' management (phase 5d): the lists by tab, and creating, editing, cancelling and
 * deleting a night. Every call takes the scope, which picks the endpoint: the admin's skip the
 * ownership check and D12, the organizer's have both. Creating and the flyer go through
 * AdminService for the admin, which already had them.
 */
@Service()
export class EventManagementService {
  private readonly http = inject(HttpClient);
  private readonly admin = inject(AdminService);
  private readonly events = inject(EventsService);
  private readonly organizers = inject(OrganizersService);

  /** A night as its management pages open it: null when it doesn't exist and, for the organizer,
   * when it isn't of their own page. The backend would refuse every change to another page's night;
   * this keeps its page from opening at all, numbers and buttons included. The admin opens any. */
  getManaged(scope: EventManagementScope, id: string): Observable<EventDetailDto | null> {
    const event$ = this.events
      .getEventDetail(id)
      .pipe(
        catchError((error: unknown) =>
          error instanceof HttpErrorResponse && error.status === 404 ? of(null) : throwError(() => error),
        ),
      );
    if (scope === 'admin') return event$;
    return forkJoin({ event: event$, mine: this.organizers.ensureMine() }).pipe(
      map(({ event, mine }) => (event && mine && event.organizer?.id === mine.id ? event : null)),
    );
  }

  /** One page of a tab. The backend sorts it: the closest first, the latest first for PAST. */
  list(
    scope: EventManagementScope,
    tab: EventManagementTab,
    page: number,
    size: number,
    filters: ManagedEventsFilters = {},
  ): Observable<SpringPage<EventCardDto>> {
    let params = new HttpParams().set('tab', tab).set('page', page).set('size', size);
    if (scope === 'admin') {
      if (filters.organizerId) params = params.set('organizerId', filters.organizerId);
      const search = filters.search?.trim();
      if (search) params = params.set('q', search);
    }
    const path = scope === 'admin' ? endpoints.admin.events : endpoints.organizers.myEvents;
    return this.http.get<SpringPage<EventCardDto>>(this.url(path), { params });
  }

  create(scope: EventManagementScope, body: EventCreateDto): Observable<EventDetailDto> {
    return scope === 'admin'
      ? this.admin.createEvent(body)
      : this.http.post<EventDetailDto>(this.url(endpoints.events.create), body);
  }

  update(scope: EventManagementScope, id: string, body: EventUpdateDto): Observable<EventDetailDto> {
    const path = scope === 'admin' ? endpoints.admin.updateEvent(id) : endpoints.events.update(id);
    return this.http.patch<EventDetailDto>(this.url(path), body);
  }

  updateStatus(scope: EventManagementScope, id: string, status: EventStatus): Observable<EventDetailDto> {
    const path = scope === 'admin' ? endpoints.admin.updateEventStatus(id) : endpoints.events.updateStatus(id);
    return this.http.patch<EventDetailDto>(this.url(path), { status });
  }

  delete(scope: EventManagementScope, id: string): Observable<void> {
    const path = scope === 'admin' ? endpoints.admin.deleteEvent(id) : endpoints.events.delete(id);
    return this.http.delete<void>(this.url(path));
  }

  /** Uploads or replaces the flyer. The backend converts it in the background: until it's done
   * the night's flyerStatus reads PROCESSING. */
  uploadFlyer(scope: EventManagementScope, id: string, file: File): Observable<EventDetailDto> {
    if (scope === 'admin') return this.admin.uploadEventFlyer(id, file);
    const formData = new FormData();
    formData.append('file', file);
    return this.http.patch<EventDetailDto>(this.url(endpoints.events.updateFlyer(id)), formData);
  }

  /** Takes the flyer off: the night's page shows the organizer's logo again. The answer is the
   * night with flyerUrl null and flyerStatus NONE. Not while a flyer is PROCESSING: the conversion
   * would put it back when it ends. */
  deleteFlyer(scope: EventManagementScope, id: string): Observable<EventDetailDto> {
    if (scope === 'admin') return this.admin.deleteEventFlyer(id);
    return this.http.delete<EventDetailDto>(this.url(endpoints.events.deleteFlyer(id)));
  }

  /** Takes the venue off a night, which keeps its address. The organizer's only (the admin has no
   * such endpoint), and refused for a CLUB or a VENUE, which publish in their venues only (D12). */
  removeVenue(id: string): Observable<EventDetailDto> {
    return this.http.delete<EventDetailDto>(this.url(endpoints.events.removeVenue(id)));
  }

  private url(path: string): string {
    return `${environment.apiUrl}${path}`;
  }
}
