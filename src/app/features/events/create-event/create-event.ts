import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, debounceTime, finalize, forkJoin, of, switchMap } from 'rxjs';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CityDto } from '@/core/models/city.model';
import { DanceStyleDto } from '@/core/models/dance-style.model';
import { EventCreateDto, EventType } from '@/core/models/event.model';
import { AddressSuggestion } from '@/core/models/geocoding.model';
import { OrganizerDetailDto } from '@/core/models/organizer.model';
import { VenuesSummaryDto } from '@/core/models/venue.model';
import { CitiesService } from '@/core/services/cities.service';
import { DanceStylesService } from '@/core/services/dance-styles.service';
import { EventsService } from '@/core/services/events.service';
import { GeocodingService } from '@/core/services/geocoding.service';
import { OrganizersService } from '@/core/services/organizers.service';
import { VenuesService } from '@/core/services/venues.service';
import { Navbar } from '@/shared/navbar/navbar';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';

/** Etichette italiane dei tipi di evento — il valore inviato resta l'enum del backend. */
export const EVENT_TYPE_LABELS: { value: EventType; label: string }[] = [
  { value: 'EVENT', label: 'Evento' },
  { value: 'SCHOOL', label: 'Scuola' },
  { value: 'CLUB', label: 'Club' },
  { value: 'BAR', label: 'Bar' },
];

const PRICE_MAX = 100000;

/** La data di inizio deve essere ancora futura al momento dell'invio. */
const futureDateTime: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  if (!control.value) return null;
  return new Date(control.value).getTime() > Date.now() ? null : { future: true };
};

/**
 * Converte un valore `datetime-local` (es. "2026-09-20T22:00", già in ora
 * locale) in OffsetDateTime ISO con l'offset del browser: "2026-09-20T22:00:00+02:00".
 * Il backend deserializza OffsetDateTime, non Instant.
 */
export function toOffsetDateTime(value: string): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** L'indirizzo libero è obbligatorio solo quando non è stato scelto un venue. */
const addressRequiredWithoutVenue: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const parent = control.parent;
  if (!parent || parent.get('venueId')?.value) return null;
  return typeof control.value === 'string' && control.value.trim() ? null : { required: true };
};

/** Il prezzo è obbligatorio e non negativo solo quando l'evento non è gratuito. */
const priceRequiredWhenPaid: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const parent = control.parent;
  if (!parent || parent.get('free')?.value) return null;
  const price = Number(control.value);
  if (control.value === null || control.value === '' || Number.isNaN(price))
    return { required: true };
  return price >= 0 && price <= PRICE_MAX ? null : { min: true };
};

/** endAt deve venire dopo startAt. */
const endAfterStart: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const startAt = group.get('startAt')?.value as string | null;
  const endAt = group.get('endAt')?.value as string | null;
  if (!startAt || !endAt) return null;
  return new Date(endAt) > new Date(startAt) ? null : { endBeforeStart: true };
};

@Component({
  selector: 'app-create-event',
  imports: [ReactiveFormsModule, Navbar, HlmButton, HlmSelectImports, HlmInput, HlmLabel],
  templateUrl: './create-event.html',
  styleUrl: './create-event.css',
})
export class CreateEvent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly organizersApi = inject(OrganizersService);
  private readonly citiesApi = inject(CitiesService);
  private readonly danceStylesApi = inject(DanceStylesService);
  private readonly venuesApi = inject(VenuesService);
  private readonly events = inject(EventsService);
  private readonly geocodingApi = inject(GeocodingService);

  readonly eventTypes = EVENT_TYPE_LABELS;

  protected readonly organizers = signal<OrganizerDetailDto[]>([]);
  protected readonly cities = signal<CityDto[]>([]);
  protected readonly danceStyles = signal<DanceStyleDto[]>([]);
  protected readonly venues = signal<VenuesSummaryDto[]>([]);

  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly venuesLoading = signal(false);
  // Segnalto, non computed: il valore di un FormControl non è reattivo.
  protected readonly venueChosen = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly selectedStyleIds = signal<ReadonlySet<number>>(new Set());

  /** Testo libero dell'indirizzo: pilota la ricerca Photon con debounce. */
  protected readonly addressSearch = signal('');
  protected readonly addressSearching = signal(false);
  /** Suggestion Photon selezionata: le sue coordinate partono col payload. */
  protected readonly selectedSuggestion = signal<AddressSuggestion | null>(null);

  private readonly addressQuery = computed(() => this.addressSearch().trim());

  /** Suggerimenti Photon: minimo 3 caratteri, debounce 300 ms, tutte le righe deduplicate dal servizio. */
  protected readonly addressSuggestions = toSignal(
    toObservable(this.addressQuery).pipe(
      debounceTime(300),
      switchMap((query) => {
        if (query.length < 3) return of<AddressSuggestion[]>([]);
        this.addressSearching.set(true);
        return this.geocodingApi.searchAddress(query).pipe(
          // Un errore Photon lascia il campo editabile a mano: lista vuota, nessun blocco.
          catchError(() => of<AddressSuggestion[]>([])),
          finalize(() => this.addressSearching.set(false)),
        );
      }),
    ),
    { initialValue: [] as AddressSuggestion[] },
  );

  /** Solo gli organizers verificati: il backend rifiuta con 403 qualsiasi altro. */
  protected readonly verifiedOrganizers = computed(() =>
    this.organizers().filter((organizer) => organizer.verified),
  );
  protected readonly noVerifiedOrganizers = computed(
    () => !this.loading() && !this.loadFailed() && this.verifiedOrganizers().length === 0,
  );

  protected readonly form = this.fb.nonNullable.group(
    {
      organizerId: ['', Validators.required],
      title: ['', [Validators.required, Validators.maxLength(150)]],
      eventType: ['' as EventType | '', Validators.required],
      description: ['', Validators.maxLength(2000)],
      cityId: ['', Validators.required],
      venueId: [''],
      address: [''],
      startAt: ['', [Validators.required, futureDateTime]],
      endAt: ['', Validators.required],
      free: [true],
      price: [null as number | null],
      instagramUrl: ['', Validators.maxLength(255)],
      whatsappUrl: ['', Validators.maxLength(255)],
    },
    { validators: endAfterStart },
  );

  constructor() {
    this.form.controls.address.addValidators(addressRequiredWithoutVenue);
    this.form.controls.price.addValidators(priceRequiredWhenPaid);
    // addValidators non ricalcola la validità da solo: serve un giro esperto.
    this.form.controls.address.updateValueAndValidity();
    this.form.controls.price.updateValueAndValidity();
    // I validatori cross-field (indirizzo/prezzo) dipendono da un fratello:
    // senza questi hook la loro validità resterebbe vecchia quando il
    // fratello cambia via patchValue o programmaticamente.
    this.form.controls.free.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.price.updateValueAndValidity());
    this.form.controls.venueId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.form.controls.address.updateValueAndValidity();
    });
    // L'effetto copia le coordinate solo finché l'indirizzo coincide con la
    // suggestion selezionata: appena l'utente riscrive a mano, le coordinate
    // vengono scartate e il backend geocodifica.
    effect(() => {
      const suggestion = this.selectedSuggestion();
      if (suggestion && this.addressSearch().trim() !== suggestion.label) {
        this.selectedSuggestion.set(null);
      }
    });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.errorMessage.set(null);
    forkJoin({
      organizers: this.organizersApi.getMyOrganizers(),
      cities: this.citiesApi.getCities(),
      danceStyles: this.danceStylesApi.getDanceStyles(),
    }).subscribe({
      next: ({ organizers, cities, danceStyles }) => {
        this.organizers.set(organizers);
        this.cities.set(cities);
        this.danceStyles.set(danceStyles);
        this.loading.set(false);
        const verified = organizers.filter((organizer) => organizer.verified);
        if (verified.length === 1) this.form.controls.organizerId.setValue(verified[0].id);
      },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
      },
    });
  }

  protected onCityChange(cityId: string | null | undefined): void {
    // Cambiare città invalida il venue scelto: la lista cambia per intero.
    this.form.controls.venueId.setValue('');
    if (!cityId) {
      this.venues.set([]);
      return;
    }
    this.venuesLoading.set(true);
    this.venuesApi.listByCity(Number(cityId)).subscribe({
      next: (venues) => {
        this.venues.set(venues);
        this.venuesLoading.set(false);
      },
      error: () => {
        this.venues.set([]);
        this.venuesLoading.set(false);
      },
    });
  }

  /** Il venue si deseleziona riportando il form a indirizzo libero. */
  protected onVenueChange(venueId: string | null | undefined): void {
    this.venueChosen.set(!!venueId);
  }

  /** Ogni battuta aggiorna il segnale di ricerca: l'effetto scarta la suggestion non più coincidente. */
  protected onAddressInput(value: string): void {
    this.addressSearch.set(value);
  }

  protected selectSuggestion(suggestion: AddressSuggestion): void {
    this.selectedSuggestion.set(suggestion);
    this.form.controls.address.setValue(suggestion.label);
    this.addressSearch.set(suggestion.label);
  }

  protected readonly addressItemToString = (suggestion: AddressSuggestion): string =>
    suggestion.label;

  /** hlm-select non accetta globali in template: l'id numerico va già in stringa. */
  protected cityValue(city: CityDto): string {
    return String(city.id);
  }

  // Il contenuto dello select è un portal lazy: con il valore preimpostato da
  // codice gli item non esistono ancora e il value mostrerebbe l'ID crudo.
  // itemToString risolve l'etichetta direttamente dai dati caricati.
  protected readonly organizerLabel = (value: string) =>
    this.verifiedOrganizers().find((organizer) => organizer.id === value)?.name ?? value;
  protected readonly cityLabel = (value: string) =>
    this.cities().find((city) => this.cityValue(city) === value)?.name ?? value;
  protected readonly venueLabel = (value: string) =>
    this.venues().find((venue) => venue.id === value)?.name ?? '';
  protected readonly eventTypeLabel = (value: string) =>
    this.eventTypes.find((type) => type.value === value)?.label ?? value;

  protected toggleStyle(id: number): void {
    this.selectedStyleIds.update((styles) => {
      const next = new Set(styles);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected setFree(free: boolean): void {
    this.form.controls.free.setValue(free);
  }

  protected submit(): void {
    // Una data valida quando è stata scelta può diventare passata mentre si compila il form.
    this.form.controls.startAt.updateValueAndValidity();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.events.createEvent(this.buildDto()).subscribe({
      next: (event) => {
        this.submitting.set(false);
        // La seconda fase vive su una route con l'ID: una ricarica la recupera
        // via GET /rest/events/{id}/manage, non c'è bisogno di tenere stato in memoria.
        this.router.navigate(['/organizer/events', event.id, 'publish']);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(
          err?.error?.message ??
            "Si è verificato un errore durante la creazione dell'evento. Riprova.",
        );
      },
    });
  }

  protected buildDto(): EventCreateDto {
    const value = this.form.getRawValue();
    const venue = this.venues().find((candidate) => candidate.id === value.venueId) ?? null;
    const suggestion = this.selectedSuggestion();
    return {
      organizerId: value.organizerId,
      venueId: venue?.id ?? null,
      cityId: Number(value.cityId),
      title: value.title.trim(),
      eventType: value.eventType as EventType,
      description: value.description?.trim() || null,
      instagramUrl: value.instagramUrl?.trim() || null,
      whatsappUrl: value.whatsappUrl?.trim() || null,
      startAt: toOffsetDateTime(value.startAt),
      endAt: toOffsetDateTime(value.endAt),
      free: value.free,
      price: value.free ? null : Number(value.price),
      currency: 'EUR',
      // Con il venue vince l'indirizzo censito; altrimenti il testo libero
      // (eventualmente la suggestion Photon selezionata).
      address: venue ? venue.address : value.address.trim(),
      ...(venue
        ? { latitude: venue.latitude, longitude: venue.longitude }
        : suggestion
          ? { latitude: suggestion.latitude, longitude: suggestion.longitude }
          : {}),
      danceStyleIds: [...this.selectedStyleIds()],
    };
  }
}
