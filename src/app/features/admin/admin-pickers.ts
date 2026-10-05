import { computed, effect, inject, signal, WritableSignal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { catchError, combineLatest, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { GeocodingService } from '../../core/services/geocoding.service';
import { VenuesService } from '../../core/services/venues.service';
import { AddressSuggestion } from '../../core/models/geocoding.model';
import { OrganizerSummaryDto } from '../../core/models/organizer.model';
import { VenuesSummaryDto } from '../../core/models/venue.model';

/*
 * The admin forms' shared pickers — organizer, address, venue: the signals an
 * hlm-autocomplete binds to, plus what picking fills in. Call them from an
 * injection context (a field initializer), after the form they write to:
 * `protected readonly organizer = injectOrganizerPicker(this.form.controls.organizerId);`
 * The viewChild that opens each dropdown stays in the component: queries
 * can't move out of it.
 */

/** Photon needs at least this many characters before a search is worth firing. */
const ADDRESS_SEARCH_MIN_LENGTH = 3;
/** How long to wait after the last keystroke before querying the venues or Photon. */
const SEARCH_DEBOUNCE_MS = 300;

/** The verified organizers (first 100), filtered client-side by what's typed. */
export function injectOrganizerPicker(organizerId: FormControl<string>) {
  const list = toSignal(
    inject(AdminService)
      .getVerifiedOrganizers(0, 100)
      .pipe(
        map((page) => page.content),
        catchError(() => of<OrganizerSummaryDto[]>([])),
      ),
    { initialValue: [] as OrganizerSummaryDto[] },
  );
  const search = signal('');
  const selectedId = toSignal(organizerId.valueChanges, { initialValue: organizerId.value });
  return {
    search,
    filtered: computed(() => {
      const term = search().trim().toLowerCase();
      return term ? list().filter((o) => o.name.toLowerCase().includes(term)) : list();
    }),
    /** Compared by id: the list loads once, and this must never re-trigger an autofill. */
    selected: computed(() => list().find((o) => o.id === selectedId()) ?? null, {
      equal: (a, b) => a?.id === b?.id,
    }),
    itemToString: (id: string): string => list().find((o) => o.id === id)?.name ?? '',
  };
}

/** Photon address search. Picking a suggestion fills in lat/lng; free typing
 * never clears them. */
export function injectAddressSearch(
  coords: { latitude: FormControl<number | null>; longitude: FormControl<number | null> },
  debounceMs = SEARCH_DEBOUNCE_MS,
) {
  const geocoding = inject(GeocodingService);
  const search = signal('');
  const searching = signal(false);
  const suggestions = toSignal(
    toObservable(search).pipe(
      map((term) => term.trim()),
      debounceTime(debounceMs),
      distinctUntilChanged(),
      switchMap((term) => {
        if (term.length < ADDRESS_SEARCH_MIN_LENGTH) {
          searching.set(false);
          return of<AddressSuggestion[]>([]);
        }
        searching.set(true);
        return geocoding.searchAddress(term).pipe(
          catchError(() => of<AddressSuggestion[]>([])),
          tap(() => searching.set(false)),
        );
      }),
    ),
    { initialValue: [] as AddressSuggestion[] },
  );

  effect(() => {
    if (searching()) {
      return;
    }
    const suggestion = suggestions().find((s) => s.label === search());
    if (suggestion) {
      coords.latitude.setValue(suggestion.latitude);
      coords.longitude.setValue(suggestion.longitude);
    }
  });

  return {
    search,
    searching: searching.asReadonly(),
    suggestions,
    itemToString: (suggestion: AddressSuggestion): string => suggestion.label,
  };
}

/** The picked city's venues, searched server-side. Picking one fills in its
 * address and coordinates (clearing it leaves them); changing the city drops
 * the venue, which belongs to one city. */
export function injectVenuePicker(
  controls: {
    cityId: FormControl<number | ''>;
    venueId: FormControl<string>;
    address: FormControl<string>;
    latitude: FormControl<number | null>;
    longitude: FormControl<number | null>;
  },
  /** The address autocomplete's search, so it shows the venue's address. */
  addressSearch: WritableSignal<string>,
) {
  const venuesService = inject(VenuesService);
  const search = signal('');
  const cityId = toSignal(controls.cityId.valueChanges, { initialValue: controls.cityId.value });
  /** The form's venueId — what gets saved. Clearing the autocomplete writes
   * null into it, despite a nonNullable form. */
  const id = toSignal(controls.venueId.valueChanges, { initialValue: controls.venueId.value });
  const venues = toSignal(
    combineLatest([
      toObservable(cityId),
      toObservable(search).pipe(
        map((term) => term.trim()),
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
      ),
    ]).pipe(
      switchMap(([city, term]) =>
        // The select may write null too: anything but a number is no city.
        typeof city !== 'number'
          ? of<VenuesSummaryDto[]>([])
          : venuesService.getVenues(city, term || undefined).pipe(catchError(() => of<VenuesSummaryDto[]>([]))),
      ),
    ),
    { initialValue: [] as VenuesSummaryDto[] },
  );
  /** Compared by id: refetching returns fresh objects, which must not re-trigger the autofill. */
  const selected = computed(() => venues().find((v) => v.id === id()) ?? null, {
    equal: (a, b) => a?.id === b?.id,
  });

  effect(() => {
    const venue = selected();
    if (!venue) {
      return;
    }
    controls.address.setValue(venue.address);
    controls.latitude.setValue(venue.latitude);
    controls.longitude.setValue(venue.longitude);
    addressSearch.set(venue.address);
  });

  // distinctUntilChanged: disable()/enable() re-emit the same city, which must
  // not clear the venue (it did, right after saving).
  controls.cityId.valueChanges.pipe(distinctUntilChanged(), takeUntilDestroyed()).subscribe(() => {
    controls.venueId.setValue('');
    search.set('');
  });

  return {
    search,
    venues,
    selected,
    id,
    itemToString: (venueId: string): string => venues().find((v) => v.id === venueId)?.name ?? '',
  };
}
