import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { BrnSelectTrigger, BrnSelectValue } from '@spartan-ng/brain/select';
import { BrnAlertDialogContent } from '@spartan-ng/brain/alert-dialog';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { SidebarPushDirective } from '../../../shared/directives/sidebar-push.directive';
import { AdminService } from '../../../core/services/admin.service';
import { CitiesService } from '../../../core/services/cities.service';
import { VenuesService } from '../../../core/services/venues.service';
import { CityDto } from '../../../core/models/city.model';
import { VenuesSummaryDto, VenueType } from '../../../core/models/venue.model';
import { VENUE_TYPES } from '../venue-form';

/** One city's venues, newest first, each with its edit and delete. The city
 * is kept in the URL (?city=), so coming back from UpdateVenue lands on it. */
@Component({
  selector: 'app-venue-list',
  imports: [
    RouterLink, DatePipe, SidebarPushDirective, HlmSelectImports, BrnSelectTrigger, BrnSelectValue,
    HlmAlertDialogImports, BrnAlertDialogContent, HlmButton,
  ],
  templateUrl: './venue-list.html',
})
export class VenueList {
  private readonly admin = inject(AdminService);
  private readonly venuesService = inject(VenuesService);
  private readonly router = inject(Router);

  /** Undefined until they arrive. */
  protected readonly cities = toSignal(
    inject(CitiesService).getCities().pipe(catchError(() => of<CityDto[]>([]))),
  );
  protected readonly cityItemToString = (id: number): string =>
    this.cities()?.find((c) => c.id === id)?.name ?? '';

  private readonly cityParam = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => Number(params.get('city')) || null)),
  );
  /** The city in the URL, else the first one. */
  protected readonly cityId = computed(() => this.cityParam() ?? this.cities()?.[0]?.id ?? null);

  private readonly venuesLoading = signal(true);
  protected readonly loading = computed(() => this.cities() === undefined || this.venuesLoading());
  protected readonly search = signal('');
  protected readonly deletingId = signal<string | null>(null);
  /** The delete that failed, and why — shown on that venue's row. */
  protected readonly deleteError = signal<{ id: string; message: string } | null>(null);

  private readonly venues = signal<VenuesSummaryDto[]>([]);

  /** Newest first; filtered by name on what's already loaded. */
  protected readonly shown = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.venues()
      .filter((v) => !term || v.name.toLowerCase().includes(term))
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  });

  constructor() {
    toObservable(this.cityId)
      .pipe(
        tap(() => {
          this.venuesLoading.set(true);
          this.deleteError.set(null);
        }),
        switchMap((cityId) =>
          cityId === null
            ? of<VenuesSummaryDto[]>([])
            : this.venuesService.getVenues(cityId).pipe(catchError(() => of<VenuesSummaryDto[]>([]))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((venues) => {
        this.venues.set(venues);
        this.venuesLoading.set(false);
      });
  }

  protected selectCity(cityId: number | null | undefined): void {
    if (cityId == null || cityId === this.cityId()) {
      return;
    }
    this.search.set('');
    this.router.navigate([], { queryParams: { city: cityId }, replaceUrl: true });
  }

  protected typeLabel(type: VenueType): string {
    return VENUE_TYPES.find((t) => t.value === type)?.label ?? type;
  }

  protected deleteVenue(venue: VenuesSummaryDto): void {
    this.deletingId.set(venue.id);
    this.deleteError.set(null);
    this.admin.deleteVenue(venue.id).subscribe({
      next: () => {
        this.venues.update((venues) => venues.filter((v) => v.id !== venue.id));
        this.deletingId.set(null);
      },
      error: (err: HttpErrorResponse) => {
        this.deletingId.set(null);
        // 409 = VenueHasActiveEventsException: events not cancelled still point at it.
        this.deleteError.set({
          id: venue.id,
          message: err.status === 409
            ? 'Non si può eliminare: ha ancora eventi attivi. Annullali o spostali prima.'
            : err.error?.message ?? 'Eliminazione non riuscita. Riprova.',
        });
      },
    });
  }
}
