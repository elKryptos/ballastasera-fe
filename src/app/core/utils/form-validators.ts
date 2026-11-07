import { AbstractControl, ValidationErrors } from '@angular/forms';
import { instagramHandle } from './event-format';

/** Same rule as the backend's @Pattern, on the handle left of whatever was
 * typed or pasted: "@name" or an instagram.com link are fine too. */
export function validInstagram(control: AbstractControl<string>): ValidationErrors | null {
  return /^[A-Za-z0-9._]{1,30}$/.test(instagramHandle(control.value)) ? null : { instagram: true };
}

/** validInstagram, for a field that may stay empty. */
export function optionalInstagram(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() ? validInstagram(control) : null;
}

export function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() ? null : { required: true };
}

/** A full web address, as the backend stores it. */
export const WEBSITE_PATTERN = /^https?:\/\/\S+$/i;
