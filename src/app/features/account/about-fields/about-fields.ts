import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { BIO_MAX } from '../../../core/config/social';
import { RequestField } from '../../../shared/request-field/request-field';
import { HomeCityField } from '../home-city-field/home-city-field';
import { OriginCountryField } from '../origin-country-field/origin-country-field';
import { PROFILE_FORM } from '../profile-form';
import { UsernameField } from '../username-field/username-field';

/** "Chi sei" with the social features (canvas 4b): the username, the bio, the town and the country
 * of origin. Part of the account's one form (PROFILE_FORM), saved by its "Salva". */
@Component({
  selector: 'app-about-fields',
  imports: [ReactiveFormsModule, RequestField, HomeCityField, OriginCountryField, UsernameField],
  templateUrl: './about-fields.html',
  // Its fields are items of the section's grid ("Chi sei" in the account): two columns where there's room.
  host: { class: 'contents' },
})
export class AboutFields {
  protected readonly form = inject(PROFILE_FORM);
  protected readonly bioMax = BIO_MAX;
}
