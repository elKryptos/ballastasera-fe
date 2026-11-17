import { AbstractControl, ValidationErrors } from '@angular/forms';
import { MAX_AGE, MIN_AGE } from '../config/dance-profile';
import { instagramHandle } from './event-format';
import { isValidWhatsapp } from './whatsapp';

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

/** A WhatsApp number however it was typed (see normalizeWhatsapp), for a field that may stay empty. */
export function optionalWhatsapp(control: AbstractControl<string>): ValidationErrors | null {
  return !control.value.trim() || isValidWhatsapp(control.value) ? null : { whatsapp: true };
}

/** The date `years` years before (or after) `today`, as a date input writes it (yyyy-MM-dd).
 * A 29 February lands on the 28th, as java.time's minusYears does. */
export function shiftYears(today: Date, years: number): string {
  const year = today.getFullYear() + years;
  const month = today.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(today.getDate(), lastDay);
  return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The backend's rule (UserUpdateDto.isBirthDateValid): at least MIN_AGE today, and younger
 * than MAX_AGE. Empty is fine: the birth date is optional. Dates are compared as yyyy-MM-dd
 * text, so no time zone gets in the way. */
export function birthDateAllowed(value: string, today = new Date()): boolean {
  if (!value) return true;
  return value <= shiftYears(today, -MIN_AGE) && value > shiftYears(today, -MAX_AGE);
}

export function birthDateInRange(control: AbstractControl<string>): ValidationErrors | null {
  return birthDateAllowed(control.value) ? null : { birthDate: true };
}

/** A full web address, as the backend stores it. */
export const WEBSITE_PATTERN = /^https?:\/\/\S+$/i;
