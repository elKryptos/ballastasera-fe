import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CityDto } from '../../../core/models/city.model';
import { DanceStyleDto } from '../../../core/models/dance-style.model';
import { EventDetailDto } from '../../../core/models/event.model';
import { OrganizerDetailDto } from '../../../core/models/organizer.model';
import { VenueDetailDto } from '../../../core/models/venue.model';
import { VenuesService } from '../../../core/services/venues.service';
import { scheduleRange } from '../../../core/utils/event-schedule';
import { EventEditorFormStore } from './event-editor-form.store';

const MILANO = { id: 1, name: 'Milano' } as CityDto;
const STYLES = [
  { id: 1, name: 'Salsa' },
  { id: 2, name: 'Bachata' },
  { id: 3, name: 'Kizomba' },
] as DanceStyleDto[];
const ORGANIZER = {
  id: 'o1',
  name: 'Salsa Loca Milano',
  type: 'PERSON',
  instagram: 'salsaloca.milano',
  phone: '+39 333 1234567',
} as OrganizerDetailDto;
const VENUE = {
  id: 'v1',
  name: 'Sala Isola',
  type: 'CLUB',
  address: 'Via Borsieri 12, Milano',
  latitude: 45.49,
  longitude: 9.19,
} as const;
const VENUE_DETAIL = { ...VENUE, cityId: 1, instagram: 'sala.isola', whatsapp: null } as unknown as VenueDetailDto;
/** A day well ahead, so the start always lies in the future. */
const FUTURE_DAY = `${new Date().getFullYear() + 1}-11-14`;

const EVENT = {
  id: 'e1',
  title: 'Social Salsa',
  eventType: 'EVENT',
  description: 'Lezione prima della social',
  ...scheduleRange({ date: FUTURE_DAY, start: '21:30', end: '02:00' }),
  free: false,
  price: 10,
  currency: 'EUR',
  address: VENUE.address,
  latitude: VENUE.latitude,
  longitude: VENUE.longitude,
  cityName: 'Milano',
  instagramUrl: 'https://www.instagram.com/salsaloca.milano/',
  whatsappUrl: 'https://wa.me/393331234567',
  organizer: ORGANIZER,
  venue: { id: 'v1', name: 'Sala Isola', address: VENUE.address, type: 'OTHER' },
  danceStyles: ['Salsa', 'Kizomba'],
  status: 'PUBLISHED',
} as unknown as EventDetailDto;

describe('EventEditorFormStore', () => {
  let store: EventEditorFormStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [EventEditorFormStore, { provide: VenuesService, useValue: { getVenueDetail: () => of(VENUE_DETAIL) } }],
    });
    store = TestBed.inject(EventEditorFormStore);
  });

  /** What the user fills in for a new night held at a venue. */
  const fillNewNight = () => {
    store.form.patchValue({
      title: '  Social Salsa ',
      eventType: 'EVENT',
      danceStyleIds: [1, 2],
      schedule: { date: FUTURE_DAY, start: '21:30', end: '02:00' },
    });
    store.pickVenue(VENUE);
  };

  describe('a new night', () => {
    it('is the organizer\'s own page, in the only city, with the organizer\'s contacts', () => {
      store.startCreate('organizer', ORGANIZER, [MILANO]);
      TestBed.tick();
      const value = store.form.getRawValue();
      expect(value.organizerId).toBe('o1');
      expect(store.form.controls.organizerId.disabled).toBe(true);
      expect(value.cityId).toBe(1);
      expect(value.instagram).toBe('salsaloca.milano');
      expect(value.whatsapp).toBe('+39 333 1234567');
    });

    it('leaves the organizer and the city to the admin when there are several', () => {
      store.startCreate('admin', null, [MILANO, { id: 2, name: 'Roma' } as CityDto]);
      expect(store.form.controls.organizerId.enabled).toBe(true);
      expect(store.form.controls.cityId.value).toBe('');
    });

    it('takes the venue\'s address, city and contacts, but keeps a contact typed by hand', () => {
      store.startCreate('organizer', ORGANIZER, [MILANO]);
      store.form.controls.whatsapp.setValue('+39 02 1234567');
      store.form.controls.whatsapp.markAsDirty();
      store.form.controls.cityId.setValue('');
      store.pickVenue(VENUE);
      TestBed.tick();
      const value = store.form.getRawValue();
      expect(value).toEqual(expect.objectContaining({ venueId: 'v1', address: VENUE.address, latitude: 45.49, cityId: 1 }));
      expect(value.instagram).toBe('sala.isola');
      expect(value.whatsapp).toBe('+39 02 1234567');
      expect(store.venue()).toEqual({ id: 'v1', name: 'Sala Isola', address: VENUE.address, type: 'CLUB' });
    });

    it('is sent whole, with the links built from the handle and the number', () => {
      store.startCreate('organizer', ORGANIZER, [MILANO]);
      fillNewNight();
      TestBed.tick();
      const body = store.createBody();
      expect(body).toEqual(expect.objectContaining({
        organizerId: 'o1',
        venueId: 'v1',
        cityId: 1,
        title: 'Social Salsa',
        description: null,
        instagramUrl: 'https://www.instagram.com/sala.isola/',
        whatsappUrl: 'https://wa.me/393331234567',
        free: true,
        price: null,
        currency: 'EUR',
        danceStyleIds: [1, 2],
      }));
      expect(new Date(body.endAt).getDate()).toBe(15);
    });

    it("takes the venue's kind over one picked by hand, and locks it", () => {
      store.startCreate('admin', null, [MILANO]);
      const { eventType } = store.form.controls;
      eventType.setValue('SCHOOL');
      eventType.markAsDirty();
      store.pickVenue(VENUE);
      TestBed.tick();
      expect(eventType.value).toBe('CLUB');
      expect(eventType.disabled).toBe(true);
      store.pickVenue({ ...VENUE, id: 'v2', type: 'OTHER' });
      TestBed.tick();
      expect(eventType.value).toBe('EVENT');
    });

    it("leaves a school's kind to a lesson or a social: a lesson, unless one of them is already chosen", () => {
      store.startCreate('admin', null, [MILANO]);
      const { eventType } = store.form.controls;
      const SCHOOL_VENUE = { ...VENUE, id: 'v2', type: 'SCHOOL' } as const;
      store.pickVenue(VENUE);
      TestBed.tick();
      store.pickVenue(SCHOOL_VENUE);
      TestBed.tick();
      expect(eventType.value).toBe('SCHOOL');
      expect(eventType.enabled).toBe(true);

      eventType.setValue('EVENT');
      store.pickVenue(SCHOOL_VENUE);
      TestBed.tick();
      expect(eventType.value).toBe('EVENT');
      expect(store.venueEventType()).toBeNull();
      expect(store.schoolEventTypes()).toEqual(['EVENT', 'SCHOOL']);

      store.form.controls.placeMode.setValue('address');
      expect(store.schoolEventTypes()).toBeNull();
    });

    it('frees the kind, as it was left, without a venue', () => {
      store.startCreate('admin', null, [MILANO]);
      const { eventType } = store.form.controls;
      store.pickVenue(VENUE);
      TestBed.tick();
      store.clearVenue();
      TestBed.tick();
      expect(eventType.enabled).toBe(true);
      expect(eventType.value).toBe('CLUB');

      store.pickVenue(VENUE);
      TestBed.tick();
      store.form.controls.placeMode.setValue('address');
      TestBed.tick();
      expect(eventType.enabled).toBe(true);
    });

    it('goes without a venue when held at an address', () => {
      store.startCreate('organizer', ORGANIZER, [MILANO]);
      fillNewNight();
      store.form.patchValue({ placeMode: 'address', address: 'Piazza Duomo 1, Milano' });
      expect(store.createBody().venueId).toBeNull();
    });
  });

  describe('rules', () => {
    beforeEach(() => store.startCreate('admin', null, [MILANO]));

    it('wants a venue, or an address, as "Dove" says', () => {
      expect(store.form.hasError('venueRequired')).toBe(true);
      store.form.controls.placeMode.setValue('address');
      expect(store.form.hasError('addressRequired')).toBe(true);
      store.form.controls.address.setValue('Piazza Duomo 1');
      expect(store.form.hasError('addressRequired')).toBe(false);
    });

    it('wants a price for a paid night', () => {
      store.form.controls.free.setValue(false);
      expect(store.form.hasError('priceRequired')).toBe(true);
      store.form.controls.price.setValue(10);
      expect(store.form.hasError('priceRequired')).toBe(false);
    });

    it('refuses a start already gone, once its day or time is touched', () => {
      const schedule = store.form.controls.schedule;
      schedule.setValue({ date: '2020-01-10', start: '21:00', end: '23:00' });
      expect(schedule.hasError('startsInPast')).toBe(false);
      schedule.controls.end.markAsDirty();
      schedule.updateValueAndValidity();
      expect(schedule.hasError('startsInPast')).toBe(false);
      schedule.controls.start.markAsDirty();
      schedule.updateValueAndValidity();
      expect(schedule.hasError('startsInPast')).toBe(true);
    });

    it('takes an address emptied by its autocomplete (null) for a missing one', () => {
      store.form.controls.placeMode.setValue('address');
      store.form.controls.address.setValue(null as unknown as string);
      expect(store.form.hasError('addressRequired')).toBe(true);
    });
  });

  describe('editing a night', () => {
    beforeEach(() => store.startEdit('organizer', EVENT, [MILANO], STYLES));

    it('fills the form from the saved night', () => {
      expect(store.form.getRawValue()).toEqual(expect.objectContaining({
        organizerId: 'o1',
        danceStyleIds: [1, 3],
        schedule: { date: FUTURE_DAY, start: '21:30', end: '02:00' },
        placeMode: 'venue',
        cityId: 1,
        venueId: 'v1',
        free: false,
        price: 10,
        instagram: 'salsaloca.milano',
        whatsapp: '+393331234567',
      }));
      expect(store.form.controls.organizerId.disabled).toBe(true);
      expect(store.form.pristine).toBe(true);
    });

    it('sends only what changed', () => {
      store.form.controls.title.setValue('Kizomba Night');
      store.form.controls.title.markAsDirty();
      expect(store.updateBody()).toEqual({ title: 'Kizomba Night' });
    });

    it('clears an emptied contact with ""', () => {
      store.form.controls.instagram.setValue('');
      store.form.controls.instagram.markAsDirty();
      expect(store.updateBody()).toEqual({ instagramUrl: '' });
    });

    it('moves just the end, leaving the start as it was', () => {
      const { end } = store.form.controls.schedule.controls;
      end.setValue('03:00');
      end.markAsDirty();
      const body = store.updateBody();
      expect(body.startAt).toBeUndefined();
      expect(new Date(body.endAt!).getHours()).toBe(3);
    });

    it('sends the start too once its time is touched', () => {
      const { start } = store.form.controls.schedule.controls;
      start.setValue('22:00');
      start.markAsDirty();
      const body = store.updateBody();
      expect(new Date(body.startAt!).getHours()).toBe(22);
      expect(body.endAt).toBeDefined();
    });

    it('keeps its kind locked while it matches the venue, and sends nothing for it', () => {
      TestBed.tick();
      expect(store.form.controls.eventType.disabled).toBe(true);
      expect(store.updateBody()).toEqual({});
    });

    it('sends the venue picked by a CLUB for a night the admin left at an address', () => {
      const club = { ...ORGANIZER, type: 'CLUB' } as OrganizerDetailDto;
      store.startEdit('organizer', { ...EVENT, organizer: club, venue: null } as EventDetailDto, [MILANO], STYLES);
      expect(store.form.controls.placeMode.value).toBe('address');
      store.pickVenue({ ...VENUE, id: 'v2', type: 'BAR' });
      TestBed.tick();
      expect(store.updateBody().venueId).toBe('v2');
      expect(store.form.controls.eventType.value).toBe('BAR');
    });

    it('takes the kind of the venue it moves to', () => {
      store.pickVenue({ ...VENUE, id: 'v2', type: 'BAR' });
      TestBed.tick();
      expect(store.form.controls.eventType.value).toBe('BAR');
      expect(store.updateBody().eventType).toBe('BAR');
    });

    it('sends the place with a point typed by hand', () => {
      store.setSpot({ lat: 45.5, lng: 9.2 });
      expect(store.updateBody()).toEqual(expect.objectContaining({ latitude: 45.5, longitude: 9.2, address: VENUE.address }));
    });

    it('takes the venue off when moved to an address of its own', () => {
      expect(store.removesVenue()).toBe(false);
      store.form.controls.placeMode.setValue('address');
      store.form.controls.placeMode.markAsDirty();
      expect(store.removesVenue()).toBe(true);
      expect(store.updateBody().venueId).toBeUndefined();
    });
  });
});
