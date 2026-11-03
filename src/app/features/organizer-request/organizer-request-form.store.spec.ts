import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OrganizerRequestDto } from '../../core/models/organizer-request.model';
import { AuthService } from '../../core/services/auth.service';
import { CitiesService } from '../../core/services/cities.service';
import { OrganizersService } from '../../core/services/organizers.service';
import { OrganizerRequestFormStore } from './organizer-request-form.store';

const TARGET = { id: 'o1', name: 'Salsa Loca', slug: 'salsa-loca', type: 'SCHOOL' as const, logoUrl: null };

describe('OrganizerRequestFormStore', () => {
  let store: OrganizerRequestFormStore;
  const currentUser = signal<{ userId: string; email: string } | null>({ userId: 'u1', email: 'ana@test.it' });

  const fillContact = () => store.contact.patchValue({ instagram: '@ana.salsa', contactEmail: 'ana@test.it' });

  beforeEach(() => {
    currentUser.set({ userId: 'u1', email: 'ana@test.it' });
    TestBed.configureTestingModule({
      providers: [
        OrganizerRequestFormStore,
        { provide: AuthService, useValue: { currentUser } },
        { provide: CitiesService, useValue: { getCities: () => of([{ id: 7, name: 'Milano' }]) } },
        { provide: OrganizersService, useValue: { getBySlug: () => of({}), getVenues: () => of([]) } },
      ],
    });
    store = TestBed.inject(OrganizerRequestFormStore);
  });

  it('prefills the email with the user\'s', () => {
    expect(store.contact.controls.contactEmail.value).toBe('ana@test.it');
  });

  describe('steps', () => {
    it('has 3 until a new profile of a type with a venue', () => {
      store.organizerType.set('CLUB');
      expect(store.steps()).toEqual(['chi-sei', 'profilo', 'conferma']);

      store.startNew('Tropical');
      expect(store.steps()).toEqual(['chi-sei', 'profilo', 'locale', 'conferma']);
    });

    it('skips the venue for a new profile without one', () => {
      store.organizerType.set('PERSON');
      store.startNew('Ana');
      expect(store.needsLocale()).toBe(false);
    });

    it('skips the venue for a CLAIM, whatever the type', () => {
      store.organizerType.set('CLUB');
      store.selectClaim(TARGET);
      expect(store.needsLocale()).toBe(false);
    });
  });

  describe('canEnter', () => {
    it('stops at the first incomplete step', () => {
      expect(store.canEnter('chi-sei')).toBe(true);
      expect(store.canEnter('profilo')).toBe(false);
      expect(store.firstIncompleteStep()).toBe('chi-sei');

      store.organizerType.set('SCHOOL');
      expect(store.canEnter('profilo')).toBe(true);
      expect(store.canEnter('conferma')).toBe(false);
    });

    it('reaches conferma with a valid CLAIM', () => {
      store.organizerType.set('SCHOOL');
      store.selectClaim(TARGET);
      fillContact();
      expect(store.canEnter('conferma')).toBe(true);
    });

    it('asks for the venue before conferma on a NEW club', () => {
      store.organizerType.set('CLUB');
      store.startNew('Tropical');
      fillContact();
      expect(store.firstIncompleteStep()).toBe('locale');
      expect(store.canEnter('conferma')).toBe(false);

      store.locale.patchValue({ venueAddress: 'Via Gola 12', venueCityId: 7 });
      expect(store.canEnter('conferma')).toBe(true);
    });

    it('refuses a step the draft does not have', () => {
      store.organizerType.set('PERSON');
      store.startNew('Ana');
      expect(store.canEnter('locale')).toBe(false);
    });
  });

  describe('validation', () => {
    it.each([
      ['ana.salsa', true],
      ['@ana.salsa', true],
      ['https://www.instagram.com/ana.salsa/', true],
      ['ana salsa', false],
      ['', false],
    ])('instagram "%s" valid: %s', (value, valid) => {
      store.contact.controls.instagram.setValue(value);
      expect(store.contact.controls.instagram.valid).toBe(valid);
    });

    it('wants a whole address for the website, or none', () => {
      const website = store.profile.controls.website;
      website.setValue('');
      expect(website.valid).toBe(true);
      website.setValue('tropicalclub.it');
      expect(website.valid).toBe(false);
      website.setValue('https://tropicalclub.it');
      expect(website.valid).toBe(true);
    });

    it('marks the step\'s fields so their errors show', () => {
      store.organizerType.set('PERSON');
      store.startNew('');
      expect(store.validate('profilo')).toBe(false);
      expect(store.profile.controls.name.touched).toBe(true);
    });
  });

  describe('toCreateDto', () => {
    it('sends only the target and the proof on a CLAIM', () => {
      store.organizerType.set('SCHOOL');
      store.profile.patchValue({ name: 'leftover' });
      store.selectClaim(TARGET);
      fillContact();
      store.termsAccepted.setValue(true);

      expect(store.toCreateDto()).toEqual({
        type: 'CLAIM',
        targetOrganizerId: 'o1',
        instagram: 'ana.salsa',
        contactEmail: 'ana@test.it',
        message: undefined,
        termsAccepted: true,
      });
    });

    it('sends the profile and the venue on a NEW club', () => {
      store.organizerType.set('CLUB');
      store.startNew(' Tropical ');
      fillContact();
      store.locale.patchValue({ venueAddress: 'Via Gola 12', venueCityId: 7 });

      expect(store.toCreateDto()).toMatchObject({
        type: 'NEW',
        name: 'Tropical',
        organizerType: 'CLUB',
        venueAddress: 'Via Gola 12',
        venueCityId: 7,
      });
    });

    it('leaves a venue typed earlier out if the type no longer has one', () => {
      store.organizerType.set('CLUB');
      store.startNew('Tropical');
      store.locale.patchValue({ venueAddress: 'Via Gola 12', venueCityId: 7 });
      store.organizerType.set('PERSON');

      const dto = store.toCreateDto();
      expect(dto.venueAddress).toBeUndefined();
      expect(dto.venueCityId).toBeUndefined();
    });
  });

  describe('prefillFrom', () => {
    const rejected = {
      id: 'r1',
      status: 'REJECTED',
      instagram: 'lucia',
      contactEmail: 'lucia@test.it',
      phone: null,
      website: null,
      message: null,
    } as OrganizerRequestDto;

    it('restores a NEW, turning the city\'s name back into its id', () => {
      store.prefillFrom({
        ...rejected,
        type: 'NEW',
        organizerName: 'Tropical',
        organizerType: 'CLUB',
        description: 'Serate',
        venueAddress: 'Via Gola 12',
        venueCityName: 'Milano',
      });

      expect(store.mode()).toBe('NEW');
      expect(store.resubmittedFromId()).toBe('r1');
      expect(store.profile.controls.name.value).toBe('Tropical');
      expect(store.locale.getRawValue()).toEqual({ venueAddress: 'Via Gola 12', venueCityId: 7 });
      expect(store.canEnter('conferma')).toBe(true);
    });

    it('restores a CLAIM on its page', () => {
      store.prefillFrom({
        ...rejected,
        type: 'CLAIM',
        organizerName: 'Salsa Loca',
        organizerType: 'SCHOOL',
        organizerId: 'o1',
        organizerSlug: 'salsa-loca',
      });
      expect(store.mode()).toBe('CLAIM');
      expect(store.claimTarget()?.id).toBe('o1');
    });

    it('sends back to the search if the claimed page is gone', () => {
      store.prefillFrom({
        ...rejected,
        type: 'CLAIM',
        organizerName: 'Salsa Loca',
        organizerType: 'SCHOOL',
        organizerId: null,
        organizerSlug: null,
      });
      expect(store.mode()).toBeNull();
      expect(store.firstIncompleteStep()).toBe('profilo');
    });
  });

  it('starts over for another user', () => {
    store.organizerType.set('CLUB');
    store.ensureOwnDraft();
    expect(store.organizerType()).toBe('CLUB');

    currentUser.set({ userId: 'u2', email: 'marco@test.it' });
    store.ensureOwnDraft();
    expect(store.organizerType()).toBeNull();
    expect(store.contact.controls.contactEmail.value).toBe('marco@test.it');
  });
});
