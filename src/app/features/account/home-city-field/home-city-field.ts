import { Component, inject } from '@angular/core';
import { HomeCityDto } from '../../../core/models/user.model';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { controlValue, toggleControl } from '../../../core/utils/form-controls';
import { injectRemoteSearch } from '../../../core/utils/remote-search';
import { ToggleSwitch } from '../../../shared/toggle-switch/toggle-switch';
import { PROFILE_FORM } from '../profile-form';

/** Photon is asked from this many letters on. */
const MIN_LENGTH = 2;

/**
 * "Città dove vivi" (social phase 2, citta-plan.md): a town picked from Photon's (never an address,
 * never free text, so "torino" and "Turín" count as one), and "Mostra la città nel profilo", off by
 * default: only its name ever shows to others, and only then. Picked, it's a chip with ✕.
 */
@Component({
  selector: 'app-home-city-field',
  imports: [ToggleSwitch],
  templateUrl: './home-city-field.html',
  styleUrls: ['../search-field.css', './home-city-field.css'],
})
export class HomeCityField {
  private readonly form = inject(PROFILE_FORM);
  private readonly geocoding = inject(GeocodingService);

  protected readonly city = controlValue(this.form.controls.homeCity);
  protected readonly shown = controlValue(this.form.controls.showHomeCity);
  protected readonly search = injectRemoteSearch((term) => this.geocoding.searchCities(term), MIN_LENGTH);
  protected readonly minLength = MIN_LENGTH;

  protected pick(city: HomeCityDto): void {
    const control = this.form.controls.homeCity;
    control.setValue(city);
    control.markAsDirty();
    this.search.search.set('');
  }

  protected clear(): void {
    const control = this.form.controls.homeCity;
    control.setValue(null);
    control.markAsDirty();
  }

  protected toggleShown(): void {
    toggleControl(this.form.controls.showHomeCity);
  }

  protected label(city: HomeCityDto): string {
    return city.region ? `${city.name}, ${city.region}` : city.name;
  }
}
