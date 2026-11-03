import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable, catchError, combineLatest, concat, debounceTime, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import { CityDto } from '../../../../core/models/city.model';
import { VenuesSummaryDto } from '../../../../core/models/venue.model';
import { CitiesService } from '../../../../core/services/cities.service';
import { VenuesService } from '../../../../core/services/venues.service';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;
const MAX_RESULTS = 5;

interface SearchState {
  status: 'idle' | 'loading' | 'done' | 'error';
  results: VenuesSummaryDto[];
}

/** Picks a venue that's already on the map for a request that needs one: one
 * created earlier, or left free when its organizer was deleted. The list can't
 * tell who's taken (the summary doesn't say), so the pick itself checks. */
@Component({
  selector: 'app-existing-venue-picker',
  imports: [ReactiveFormsModule],
  host: { class: 'flex flex-col gap-2' },
  templateUrl: './existing-venue-picker.html',
})
export class ExistingVenuePicker {
  private readonly venues = inject(VenuesService);

  readonly requestId = input.required<string>();
  /** The city the request proposes, to start from. */
  readonly cityName = input<string | null>(null);
  readonly picked = output<VenuesSummaryDto>();

  protected readonly cities = toSignal(
    inject(CitiesService).getCities().pipe(catchError(() => of<CityDto[]>([]))),
    { initialValue: [] as CityDto[] },
  );
  protected readonly city = new FormControl<number | null>(null);
  protected readonly query = new FormControl('', { nonNullable: true });
  protected readonly checkingId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly minQueryLength = MIN_QUERY_LENGTH;

  protected readonly search = toSignal(
    combineLatest([
      this.city.valueChanges.pipe(startWith(this.city.value), distinctUntilChanged()),
      this.query.valueChanges.pipe(
        map((value) => value.trim()),
        debounceTime(DEBOUNCE_MS),
        startWith(''),
        distinctUntilChanged(),
      ),
    ]).pipe(switchMap(([city, name]) => this.searchFor(city, name))),
    { initialValue: { status: 'idle', results: [] } as SearchState },
  );

  constructor() {
    // The cities arrive after the request's city is known: select it once both are.
    effect(() => {
      const match = this.cities().find((city) => city.name === this.cityName());
      if (match) untracked(() => this.city.setValue(match.id));
    });
  }

  protected pick(venue: VenuesSummaryDto): void {
    this.checkingId.set(venue.id);
    this.errorMessage.set(null);
    this.venues.getVenueDetail(venue.id).subscribe({
      next: (detail) => {
        this.checkingId.set(null);
        if (detail.organizerId) {
          this.errorMessage.set(`${venue.name} è già collegato a ${detail.organizerName ?? 'un altro organizzatore'}.`);
          return;
        }
        this.picked.emit(venue);
      },
      error: () => {
        this.checkingId.set(null);
        this.errorMessage.set('Non siamo riusciti a controllare questo locale. Riprova.');
      },
    });
  }

  private searchFor(cityId: number | null, name: string): Observable<SearchState> {
    if (cityId === null || name.length < MIN_QUERY_LENGTH) return of({ status: 'idle', results: [] });
    return concat(
      of<SearchState>({ status: 'loading', results: [] }),
      this.venues.getVenues(cityId, name).pipe(
        map((venues): SearchState => ({ status: 'done', results: venues.slice(0, MAX_RESULTS) })),
        catchError(() => of<SearchState>({ status: 'error', results: [] })),
      ),
    );
  }
}
