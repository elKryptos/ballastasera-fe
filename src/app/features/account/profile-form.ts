import { InjectionToken, inject } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { BIO_MAX } from '../../core/config/social';
import { ContactVisibility, DanceRole, Gender, HomeCityDto, UserDanceStyleUpdateDto } from '../../core/models/user.model';
import { birthDateInRange, optionalInstagram, optionalWhatsapp } from '../../core/utils/form-validators';
import { SchoolPick } from '../../core/utils/user-update';
import { usernameFormat } from '../../core/utils/username';

/** "I tuoi dati" in "Il tuo account": one form, one "Salva", sent whole to PATCH /auth/me
 * (see toUserUpdate). Its value is a ProfileFormValue. */
export function createProfileForm(fb: NonNullableFormBuilder) {
  return fb.group({
    username: ['', [usernameFormat]],
    instagram: ['', [optionalInstagram]],
    showProfilePublic: [true],
    whatsapp: ['', [optionalWhatsapp]],
    whatsappVisibility: fb.control<ContactVisibility>('MUTUALS'),
    birthDate: ['', [birthDateInRange]],
    gender: fb.control<Gender | null>(null),
    danceRole: fb.control<DanceRole | null>(null),
    danceStyles: fb.control<UserDanceStyleUpdateDto[]>([]),
    bio: ['', [Validators.maxLength(BIO_MAX)]],
    attendanceVisibility: fb.control<ContactVisibility>('EVERYONE'),
    school: fb.control<SchoolPick | null>(null),
    originCountry: fb.control<string | null>(null),
    homeCity: fb.control<HomeCityDto | null>(null),
    showHomeCity: [false],
  });
}

export type ProfileForm = ReturnType<typeof createProfileForm>;

/** The account provides the form (see provideProfileForm) and its field groups
 * (whatsapp-field, dancer-fields, dance-styles-field and the social ones) inject it: no input to
 * pass down, and the same form instance from the start, so each can read its controls as signals. */
export const PROFILE_FORM = new InjectionToken<ProfileForm>('PROFILE_FORM');

export function provideProfileForm() {
  return { provide: PROFILE_FORM, useFactory: () => createProfileForm(inject(NonNullableFormBuilder)) };
}
