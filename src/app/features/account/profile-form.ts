import { InjectionToken, inject } from '@angular/core';
import { NonNullableFormBuilder } from '@angular/forms';
import { DanceRole, Gender, UserDanceStyleUpdateDto } from '../../core/models/user.model';
import { birthDateInRange, optionalInstagram, optionalWhatsapp } from '../../core/utils/form-validators';

/** "I tuoi dati" in "Il tuo account": one form, one "Salva", sent whole to PATCH /auth/me
 * (see toUserUpdate). Its value is a ProfileFormValue. */
export function createProfileForm(fb: NonNullableFormBuilder) {
  return fb.group({
    instagram: ['', [optionalInstagram]],
    showProfilePublic: [true],
    whatsapp: ['', [optionalWhatsapp]],
    whatsappVisible: [true],
    birthDate: ['', [birthDateInRange]],
    gender: fb.control<Gender | null>(null),
    danceRole: fb.control<DanceRole | null>(null),
    danceStyles: fb.control<UserDanceStyleUpdateDto[]>([]),
  });
}

export type ProfileForm = ReturnType<typeof createProfileForm>;

/** The account provides the form (see provideProfileForm) and its field groups
 * (whatsapp-field, dancer-fields, dance-styles-field) inject it: no input to pass down,
 * and the same form instance from the start, so each can read its controls as signals. */
export const PROFILE_FORM = new InjectionToken<ProfileForm>('PROFILE_FORM');

export function provideProfileForm() {
  return { provide: PROFILE_FORM, useFactory: () => createProfileForm(inject(NonNullableFormBuilder)) };
}
