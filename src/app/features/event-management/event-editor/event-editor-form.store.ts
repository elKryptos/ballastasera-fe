import { Service, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { Subject, catchError, of, switchMap } from 'rxjs';
import { EVENT_TYPE_OF_VENUE } from '../../../core/config/event-types';
import { isVenueBound } from '../../../core/config/organizer-types';
import { CityDto } from '../../../core/models/city.model';
import { DanceStyleDto } from '../../../core/models/dance-style.model';
import { EventCreateDto, EventDetailDto, EventType, EventUpdateDto } from '../../../core/models/event.model';
import { OrganizerDetailDto } from '../../../core/models/organizer.model';
import { VenueDetailDto, VenueType } from '../../../core/models/venue.model';
import { EventManagementScope } from '../../../core/services/event-management.service';
import { VenuesService } from '../../../core/services/venues.service';
import { instagramHandle, instagramUrl, waMeUrl } from '../../../core/utils/event-format';
import { EventSchedule, scheduleOf, scheduleRange } from '../../../core/utils/event-schedule';
import { notBlank, optionalInstagram } from '../../../core/utils/form-validators';

/** Where a night is held: one of the venues, or an address of its own. */
export type PlaceMode = 'venue' | 'address';

/** The venue a night is held at, as the form shows it. */
export interface PickedVenue {
  id: string;
  name: string;
  address: string;
}

/** A WhatsApp number as it's typed: digits and spaces, a + in front. */
const PHONE_PATTERN = /^\+?[\d\s]{6,20}$/;

/** The autocompletes write null into their control when their text is emptied (Spartan's
 * resetValue), despite the nonNullable form: read their text through this. */
function textOf(value: string | null): string {
  return (value ?? '').trim();
}

/** The start has to lie ahead once its day or its time is touched. Only the end touched (a night
 * that ends later, even one already under way) leaves the start as it was. */
function startsAhead(group: AbstractControl<EventSchedule>): ValidationErrors | null {
  if (!group.get('date')?.dirty && !group.get('start')?.dirty) return null;
  const range = scheduleRange(group.getRawValue());
  return range && new Date(range.startAt).getTime() <= Date.now() ? { startsInPast: true } : null;
}

/** A venue picked, or an address typed: whichever "Dove" says. */
function placeChosen(form: AbstractControl): ValidationErrors | null {
  const { placeMode, venueId, address } = form.getRawValue();
  if (placeMode === 'venue') return venueId ? null : { venueRequired: true };
  return textOf(address) ? null : { addressRequired: true };
}

function priceWhenPaid(form: AbstractControl): ValidationErrors | null {
  const { free, price } = form.getRawValue();
  return !free && price == null ? { priceRequired: true } : null;
}

/** The number in a wa.me link, with its +. Empty for any other kind of link. */
function phoneOf(whatsappUrl: string | null): string {
  const digits = whatsappUrl?.match(/wa\.me\/(\d+)/)?.[1];
  return digits ? `+${digits}` : '';
}

/**
 * The night's form, for "Nuova serata" and for editing one, and what it knows around it: the
 * organizer, the venue picked, the night being edited. The sections show it; the editor page saves
 * it with createBody() or updateBody(). Provided by the editor page: a fresh form on every visit.
 */
@Service({ autoProvided: false })
export class EventEditorFormStore {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly venuesService = inject(VenuesService);

  readonly scope = signal<EventManagementScope>('organizer');
  readonly mode = signal<'create' | 'edit'>('create');
  /** The night being edited, as it was loaded. */
  readonly event = signal<EventDetailDto | null>(null);
  /** Who organizes it: the admin's pick, or the organizer's own page. */
  readonly organizer = signal<OrganizerDetailDto | null>(null);
  readonly venue = signal<PickedVenue | null>(null);
  /** A CLUB or a VENUE publishing for itself: only in its own venues (D12). The admin isn't bound. */
  readonly venueBound = computed(() => {
    const organizer = this.organizer();
    return this.scope() === 'organizer' && organizer !== null && isVenueBound(organizer.type);
  });

  readonly form = this.fb.group(
    {
      organizerId: ['', [Validators.required]],
      title: ['', [notBlank, Validators.maxLength(150)]],
      eventType: ['' as EventType | '', [Validators.required]],
      danceStyleIds: [[] as number[]],
      description: ['', [Validators.maxLength(2000)]],
      schedule: this.fb.group(
        {
          date: ['', [Validators.required]],
          start: ['', [Validators.required]],
          end: ['', [Validators.required]],
        },
        { validators: startsAhead },
      ),
      placeMode: ['venue' as PlaceMode],
      cityId: ['' as number | '', [Validators.required]],
      venueId: [''],
      address: [''],
      latitude: [null as number | null],
      longitude: [null as number | null],
      free: [true],
      price: [null as number | null, [Validators.min(0)]],
      instagram: ['', [optionalInstagram]],
      whatsapp: ['', [Validators.pattern(PHONE_PATTERN)]],
    },
    { validators: [placeChosen, priceWhenPaid] },
  );

  readonly placeMode = toSignal(this.form.controls.placeMode.valueChanges, {
    initialValue: this.form.controls.placeMode.value,
  });
  readonly free = toSignal(this.form.controls.free.valueChanges, { initialValue: this.form.controls.free.value });
  /** Editing a night held at a venue, now at an address of its own: the venue has to come off first. */
  readonly removesVenue = computed(
    () => this.mode() === 'edit' && this.event()?.venue != null && this.placeMode() === 'address',
  );

  /** The picked venue's Instagram and WhatsApp, which come before the organizer's. */
  private readonly venueContacts = signal<{ instagram: string; phone: string } | null>(null);
  private readonly venuePicked$ = new Subject<string>();

  constructor() {
    // The picked venue's detail: its city (the organizer's venues don't come with one) and its contacts.
    this.venuePicked$
      .pipe(
        switchMap((id) => this.venuesService.getVenueDetail(id).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((venue) => {
        if (venue) this.keepVenueDetail(venue);
      });

    // A new night's contacts: the venue's, else the organizer's. Only while nobody has typed in them.
    effect(() => {
      if (this.mode() !== 'create') return;
      const venue = this.venueContacts();
      const organizer = this.organizer();
      this.prefill(this.form.controls.instagram, instagramHandle(venue?.instagram || organizer?.instagram || ''));
      this.prefill(this.form.controls.whatsapp, venue?.phone || organizer?.phone || '');
    });
  }

  /** A new night. The organizer publishes as their page; the admin picks one in the form. With a
   * single city, it's the city. */
  startCreate(scope: EventManagementScope, organizer: OrganizerDetailDto | null, cities: CityDto[]): void {
    this.scope.set(scope);
    this.mode.set('create');
    if (cities.length === 1) this.form.controls.cityId.setValue(cities[0].id);
    if (scope === 'organizer' && organizer) {
      this.form.controls.organizerId.setValue(organizer.id);
      this.form.controls.organizerId.disable();
    }
    this.organizer.set(organizer);
  }

  /** A saved night back into the form. Its city and its styles come by name, so they're looked up
   * in the lists. Its organizer can't change. */
  startEdit(scope: EventManagementScope, event: EventDetailDto, cities: CityDto[], styles: DanceStyleDto[]): void {
    this.scope.set(scope);
    this.mode.set('edit');
    this.event.set(event);
    this.organizer.set(event.organizer);
    this.venue.set(event.venue ? { id: event.venue.id, name: event.venue.name, address: event.venue.address } : null);
    this.form.reset({
      organizerId: event.organizer?.id ?? '',
      title: event.title,
      eventType: event.eventType,
      danceStyleIds: styles.filter((style) => event.danceStyles.includes(style.name)).map((style) => style.id),
      description: event.description ?? '',
      schedule: scheduleOf(event.startAt, event.endAt),
      placeMode: event.venue ? 'venue' : 'address',
      cityId: cities.find((city) => city.name === event.cityName)?.id ?? '',
      venueId: event.venue?.id ?? '',
      address: event.address,
      latitude: event.latitude,
      longitude: event.longitude,
      free: event.free,
      price: event.price,
      instagram: event.instagramUrl ? instagramHandle(event.instagramUrl) : '',
      whatsapp: phoneOf(event.whatsappUrl),
    });
    this.form.controls.organizerId.disable();
  }

  /** The admin's pick of who organizes it. */
  setOrganizer(organizer: OrganizerDetailDto | null): void {
    this.organizer.set(organizer);
  }

  /** A venue, from the search or from the organizer's own: the night takes its address and place
   * on the map, and its city and contacts once its detail is in. A new night also takes the kind
   * the venue suggests, until one is picked by hand. */
  pickVenue(venue: PickedVenue & { latitude: number | null; longitude: number | null; type: VenueType }): void {
    const controls = this.form.controls;
    controls.venueId.setValue(venue.id);
    controls.venueId.markAsDirty();
    controls.address.setValue(venue.address);
    controls.latitude.setValue(venue.latitude);
    controls.longitude.setValue(venue.longitude);
    if (this.mode() === 'create' && controls.eventType.pristine) {
      controls.eventType.setValue(EVENT_TYPE_OF_VENUE[venue.type]);
    }
    this.venue.set({ id: venue.id, name: venue.name, address: venue.address });
    this.venuePicked$.next(venue.id);
  }

  /** The point typed by hand, for an address Photon places wrong: the backend keeps it as it is. */
  setSpot(spot: { lat: number; lng: number }): void {
    const { latitude, longitude } = this.form.controls;
    latitude.setValue(spot.lat);
    longitude.setValue(spot.lng);
    latitude.markAsDirty();
    longitude.markAsDirty();
  }

  /** "Cambia": the venue goes, its address stays until another is picked. */
  clearVenue(): void {
    this.form.controls.venueId.setValue('');
    this.form.controls.venueId.markAsDirty();
    this.venue.set(null);
    this.venueContacts.set(null);
  }

  /** Everything, for POST. */
  createBody(): EventCreateDto {
    const value = this.form.getRawValue();
    const range = scheduleRange(value.schedule)!;
    return {
      organizerId: value.organizerId,
      venueId: value.placeMode === 'venue' ? value.venueId : null,
      seriesId: null,
      cityId: value.cityId as number,
      title: value.title.trim(),
      eventType: value.eventType as EventType,
      description: value.description.trim() || null,
      flyerUrl: null,
      instagramUrl: value.instagram.trim() ? instagramUrl(value.instagram) : null,
      whatsappUrl: waMeUrl(value.whatsapp),
      startAt: range.startAt,
      endAt: range.endAt,
      free: value.free,
      price: value.free ? null : value.price,
      currency: 'EUR',
      address: textOf(value.address),
      latitude: value.latitude,
      longitude: value.longitude,
      danceStyleIds: value.danceStyleIds,
    };
  }

  /** Only what was changed, for PATCH: the backend keeps whatever isn't sent. An emptied field goes
   * as "" (a null would keep the old value). The start goes only if its day or time was touched:
   * it has to lie ahead, which a night under way no longer does, and moving just the end is fine. */
  updateBody(): EventUpdateDto {
    const controls = this.form.controls;
    const value = this.form.getRawValue();
    const body: EventUpdateDto = {};
    if (controls.title.dirty) body.title = value.title.trim();
    if (controls.eventType.dirty) body.eventType = value.eventType as EventType;
    if (controls.danceStyleIds.dirty) body.danceStyleIds = value.danceStyleIds;
    if (controls.description.dirty) body.description = value.description.trim();
    const range = controls.schedule.dirty ? scheduleRange(value.schedule) : null;
    if (range) {
      const { date, start } = controls.schedule.controls;
      if (date.dirty || start.dirty) body.startAt = range.startAt;
      body.endAt = range.endAt;
    }
    const place = [controls.placeMode, controls.cityId, controls.venueId, controls.address, controls.latitude, controls.longitude];
    if (place.some((control) => control.dirty)) {
      body.cityId = value.cityId as number;
      if (value.placeMode === 'venue') body.venueId = value.venueId;
      body.address = textOf(value.address);
      body.latitude = value.latitude;
      body.longitude = value.longitude;
    }
    if (controls.free.dirty || controls.price.dirty) {
      body.free = value.free;
      if (!value.free) {
        body.price = value.price;
        body.currency = 'EUR';
      }
    }
    if (controls.instagram.dirty) body.instagramUrl = value.instagram.trim() ? instagramUrl(value.instagram) : '';
    if (controls.whatsapp.dirty) body.whatsappUrl = waMeUrl(value.whatsapp) ?? '';
    return body;
  }

  private keepVenueDetail(venue: VenueDetailDto): void {
    if (this.form.controls.venueId.value !== venue.id) return;
    this.form.controls.cityId.setValue(venue.cityId);
    this.venueContacts.set({ instagram: venue.instagram ?? '', phone: venue.whatsapp ?? '' });
  }

  private prefill(control: AbstractControl<string>, value: string): void {
    if (control.pristine) control.setValue(value);
  }
}
