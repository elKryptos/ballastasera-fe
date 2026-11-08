import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { catchError, map, of, startWith } from 'rxjs';
import { CityDto } from '../../../../core/models/city.model';
import { CitiesService } from '../../../../core/services/cities.service';
import { Choice, ChoiceGroup } from '../choice-group/choice-group';
import { EditorSection } from '../editor-section/editor-section';
import { EventEditorFormStore, PlaceMode } from '../event-editor-form.store';
import { AddressSearch } from './address-search/address-search';
import { OwnVenues } from './own-venues/own-venues';
import { VenueSearch } from './venue-search/venue-search';

const PLACE_CHOICES: Choice<PlaceMode>[] = [
  { value: 'venue', label: 'In un locale' },
  { value: 'address', label: 'Altro indirizzo' },
];

/**
 * "3 · Dove": a venue, or an address of its own. A CLUB or a VENUE publishing for itself only picks
 * among its venues (D12). Everyone else chooses the city, then searches the venues in it or types
 * an address; an organizer sees their own venues first. A picked venue gives the night its address,
 * its city and its point on the map.
 */
@Component({
  selector: 'app-place-section',
  host: { class: 'block' },
  imports: [ReactiveFormsModule, EditorSection, ChoiceGroup, VenueSearch, OwnVenues, AddressSearch],
  templateUrl: './place-section.html',
})
export class PlaceSection {
  protected readonly store = inject(EventEditorFormStore);
  protected readonly controls = this.store.form.controls;
  protected readonly placeChoices = PLACE_CHOICES;

  protected readonly cities = toSignal(
    inject(CitiesService)
      .getCities()
      .pipe(catchError(() => of<CityDto[]>([]))),
    { initialValue: [] as CityDto[] },
  );
  /** With a single city there's nothing to choose: it's already set. */
  protected readonly chooseCity = computed(() => !this.store.venueBound() && this.cities().length > 1);
  /** The admin has no way to take a venue off a night: there, the night moves to another venue. */
  protected readonly canLeaveVenue = computed(
    () => !this.store.venueBound() && !(this.store.scope() === 'admin' && this.store.event()?.venue),
  );
  protected readonly ownVenuesOf = computed(() =>
    this.store.scope() === 'organizer' ? (this.store.organizer()?.id ?? null) : null,
  );
  protected readonly atVenue = computed(() => this.store.venueBound() || this.store.placeMode() === 'venue');
  /** The venues are searched in a city: none until one is chosen. */
  protected readonly cityId = toSignal(
    this.controls.cityId.valueChanges.pipe(startWith(this.controls.cityId.value), map((id) => id || null)),
    { initialValue: null },
  );

  protected readonly showErrors = toSignal(
    this.store.form.events.pipe(
      startWith(null),
      map(() => this.controls.venueId.touched || this.controls.address.touched || this.controls.cityId.touched),
    ),
    { initialValue: false },
  );
}
