import { HttpClient } from '@angular/common/http';
import { Service, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, retry, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { endpoints } from '../api/endpoints';
import { OrganizerRequestCreateDto, OrganizerRequestDto } from '../models/organizer-request.model';
import { AuthService } from './auth.service';

/** What came of sending a request: it's created either way, the logo may not be. */
export interface SubmittedRequest {
  request: OrganizerRequestDto;
  logoUploaded: boolean;
}

/** "Diventa organizzatore": the signed-in user's latest request, kept in
 * myRequest and refreshed by everything here that changes it. */
@Service()
export class OrganizerRequestsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly loadedRequest = signal<OrganizerRequestDto | null>(null);
  /** Whose request loadedRequest holds: another user signing in starts over. */
  private readonly loadedForUserId = signal<string | null>(null);

  /** Whether myRequest is this user's answer, rather than not asked yet. */
  readonly isLoaded = computed(() => {
    const userId = this.auth.currentUser()?.userId ?? null;
    return userId !== null && this.loadedForUserId() === userId;
  });
  /** Null also until it's loaded for this user: see isLoaded. */
  readonly myRequest = computed(() => (this.isLoaded() ? this.loadedRequest() : null));
  /** The last attempt to ask failed: whoever waits on isLoaded stops waiting. */
  readonly loadFailed = signal(false);

  /** Asks the backend. It answers 204, which arrives as null, for a user who
   * never asked. A request that just left review may have changed the user's
   * role, which the session only reads at the start: asks for that too. */
  load(): Observable<OrganizerRequestDto | null> {
    const wasPending = this.myRequest()?.status === 'PENDING';
    return this.http.get<OrganizerRequestDto | null>(`${environment.apiUrl}${endpoints.organizerRequests.me}`).pipe(
      tap({
        next: (request) => this.store(request),
        error: () => this.loadFailed.set(true),
      }),
      switchMap((request) =>
        wasPending && request?.status !== 'PENDING' ? this.auth.restoreSession().pipe(map(() => request)) : of(request),
      ),
    );
  }

  /** The request already loaded for this user, or asks for it. */
  ensureLoaded(): Observable<OrganizerRequestDto | null> {
    return this.isLoaded() ? of(this.myRequest()) : this.load();
  }

  create(body: OrganizerRequestCreateDto): Observable<OrganizerRequestDto> {
    return this.http.post<OrganizerRequestDto>(`${environment.apiUrl}${endpoints.organizerRequests.create}`, body).pipe(
      tap((request) => this.store(request)),
    );
  }

  /** Accepted only once per request; the backend reads the file from the "logo" part. */
  uploadLogo(id: string, file: File): Observable<OrganizerRequestDto> {
    const formData = new FormData();
    formData.append('logo', file);
    return this.http.patch<OrganizerRequestDto>(`${environment.apiUrl}${endpoints.organizerRequests.logo(id)}`, formData).pipe(
      tap((request) => this.store(request)),
    );
  }

  /** Creates the request and uploads its logo, if any. The logo gets one
   * retry; if that fails too the request still stands, without it: it can't be
   * uploaded later while pending, only after the approval. */
  submit(body: OrganizerRequestCreateDto, logo: File | null): Observable<SubmittedRequest> {
    return this.create(body).pipe(
      switchMap((request) => {
        if (!logo) return of({ request, logoUploaded: true });
        return this.uploadLogo(request.id, logo).pipe(
          retry(1),
          map((updated) => ({ request: updated, logoUploaded: true })),
          catchError(() => of({ request, logoUploaded: false })),
        );
      }),
    );
  }

  /** The backend answers 204: what's left is the request as it stands now. */
  cancel(id: string): Observable<OrganizerRequestDto | null> {
    return this.http.delete<void>(`${environment.apiUrl}${endpoints.organizerRequests.cancel(id)}`).pipe(
      switchMap(() => this.load()),
    );
  }

  /** Seen as soon as it's asked, not when the backend answers: whoever is
   * leaving the page that showed it shouldn't be sent back there meanwhile. */
  acknowledge(id: string): Observable<OrganizerRequestDto> {
    const seen = this.loadedRequest();
    if (seen?.id === id) this.loadedRequest.set({ ...seen, acknowledgedAt: new Date().toISOString() });
    return this.http.patch<OrganizerRequestDto>(`${environment.apiUrl}${endpoints.organizerRequests.acknowledge(id)}`, {}).pipe(
      tap((request) => this.store(request)),
    );
  }

  private store(request: OrganizerRequestDto | null): void {
    this.loadFailed.set(false);
    this.loadedRequest.set(request);
    this.loadedForUserId.set(this.auth.currentUser()?.userId ?? null);
  }
}
