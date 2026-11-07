import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, computed, inject, linkedSignal } from '@angular/core';
import { Observable, finalize, forkJoin, map, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { endpoints } from '../api/endpoints';
import { publicApi } from '../interceptors/auth.interceptor';
import { OrganizerDetailDto, OrganizerOwnerUpdateDto, OrganizerSummaryDto } from '../models/organizer.model';
import { VenuesSummaryDto } from '../models/venue.model';
import { AuthService } from './auth.service';

@Service()
export class OrganizersService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  /** Who's signed in. An id, so the same user read again (the session check) doesn't count as a change. */
  private readonly userId = computed(() => this.auth.currentUser()?.userId ?? null);
  /** The signed-in user's page as the backend last told it: undefined until asked. Forgotten when another
   * user signs in, and when the page is left or deleted (forgetMine). */
  private readonly mine = linkedSignal<string | null, OrganizerDetailDto | null | undefined>({
    source: this.userId,
    computation: () => undefined,
  });

  /** The signed-in user's page, kept here so the menu, the account and the page itself show the same one,
   * renamed or with a new logo the moment it's saved. Null until ensureMine() has answered for this user,
   * and for anyone without a page. */
  readonly myOrganizer = computed(() => this.mine() ?? null);
  /** The question for it while it's on its way: whoever asks meanwhile waits for the same answer. */
  private loadingMine: Observable<OrganizerDetailDto | null> | null = null;

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

  /** The signed-in user's page as it's kept (myOrganizer), asking the backend only if it isn't yet for
   * this user and role. Everything here that changes it keeps the answer, so what's kept is what's saved. */
  ensureMine(): Observable<OrganizerDetailDto | null> {
    const mine = this.mine();
    return mine === undefined ? this.loadMine() : of(mine);
  }

  /** An organizer's page and its venues, for whoever shows them together. */
  getWithVenues(organizer: { id: string; slug: string }): Observable<{ detail: OrganizerDetailDto; venues: VenuesSummaryDto[] }> {
    return forkJoin({ detail: this.getBySlug(organizer.slug), venues: this.getVenues(organizer.id) });
  }

  /** The owner saves their page. Its link (the slug) stays the same, even with a new name. */
  update(id: string, body: OrganizerOwnerUpdateDto): Observable<OrganizerDetailDto> {
    return this.http
      .patch<OrganizerDetailDto>(`${environment.apiUrl}${endpoints.organizers.update(id)}`, body)
      .pipe(tap((organizer) => this.keepMine(organizer)));
  }

  /** The owner's new logo: the backend reads the "logo" part and deletes the old one. */
  uploadLogo(id: string, file: File): Observable<OrganizerDetailDto> {
    const formData = new FormData();
    formData.append('logo', file);
    return this.http
      .patch<OrganizerDetailDto>(`${environment.apiUrl}${endpoints.organizers.logo(id)}`, formData)
      .pipe(tap((organizer) => this.keepMine(organizer)));
  }

  /** The owner leaves a page they claimed (D13): it stays, without them. */
  release(id: string): Observable<void> {
    return this.http
      .patch<void>(`${environment.apiUrl}${endpoints.organizers.release(id)}`, {})
      .pipe(tap(() => this.forgetMine()));
  }

  /** The owner deletes a page they created with a request: its future nights are cancelled. */
  delete(id: string): Observable<void> {
    return this.http
      .delete<void>(`${environment.apiUrl}${endpoints.organizers.delete(id)}`)
      .pipe(tap(() => this.forgetMine()));
  }

  /** The backend answers with a list: at most one for now (MAX_ORGANIZERS_PER_USER). An answer that
   * lands after another user signed in belongs to who asked: it isn't kept. */
  private loadMine(): Observable<OrganizerDetailDto | null> {
    if (!this.loadingMine) {
      const askedFor = this.userId();
      this.loadingMine = this.http
        .get<OrganizerDetailDto[]>(`${environment.apiUrl}${endpoints.organizers.myOrganizers}`)
        .pipe(
          map((owned) => owned[0] ?? null),
          tap((organizer) => {
            if (this.userId() === askedFor) this.keepMine(organizer);
          }),
          finalize(() => (this.loadingMine = null)),
          shareReplay({ bufferSize: 1, refCount: true }),
        );
    }
    return this.loadingMine;
  }

  private keepMine(organizer: OrganizerDetailDto | null): void {
    if (this.userId()) this.mine.set(organizer);
  }

  /** Left or deleted: whatever page this user has next (approved again, say) is asked for, not assumed. */
  private forgetMine(): void {
    this.mine.set(undefined);
  }
}
