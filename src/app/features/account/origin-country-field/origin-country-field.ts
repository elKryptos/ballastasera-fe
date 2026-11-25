import { Component, inject } from '@angular/core';
import { COUNTRY_CODES, FREQUENT_COUNTRIES } from '../../../core/config/countries';
import { FlagEmoji } from '../../../core/utils/flags';
import { controlValue } from '../../../core/utils/form-controls';
import { countryName } from '../../../core/utils/profile-view';
import { PROFILE_FORM } from '../profile-form';

interface CountryOption {
  code: string;
  name: string;
  /** The name with the flag before it, where the device draws flags (FlagEmoji). */
  label: string;
}

/**
 * "Paese d'origine" (social phase 2): a native select, which every phone turns into its own picker
 * and every browser knows how to search by typing. The scene's most frequent countries first, then
 * all of them by their Italian name, each with its flag where the device draws flags. Shown on the
 * profile next to role and age.
 */
@Component({
  selector: 'app-origin-country-field',
  templateUrl: './origin-country-field.html',
})
export class OriginCountryField {
  private readonly form = inject(PROFILE_FORM);

  private readonly flags = inject(FlagEmoji);

  protected readonly value = controlValue(this.form.controls.originCountry);
  protected readonly frequent: CountryOption[] = FREQUENT_COUNTRIES.map((code) => this.option(code));
  protected readonly all: CountryOption[] = COUNTRY_CODES.map((code) => this.option(code)).sort((a, b) =>
    a.name.localeCompare(b.name, 'it'),
  );

  private option(code: string): CountryOption {
    const name = countryName(code);
    const flag = this.flags.of(code);
    return { code, name, label: flag ? `${flag}  ${name}` : name };
  }

  protected pick(code: string): void {
    const control = this.form.controls.originCountry;
    control.setValue(code || null);
    control.markAsDirty();
  }
}
