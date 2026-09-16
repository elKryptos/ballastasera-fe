import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CityDto } from '@/core/models/city.model';
import { DanceStyleDto } from '@/core/models/dance-style.model';
import { EventCreateDto, OrganizerEventDetailDto } from '@/core/models/event.model';
import { OrganizerDetailDto } from '@/core/models/organizer.model';
import { VenuesSummaryDto } from '@/core/models/venue.model';
import { CitiesService } from '@/core/services/cities.service';
import { DanceStylesService } from '@/core/services/dance-styles.service';
import { EventsService } from '@/core/services/events.service';
import { OrganizersService } from '@/core/services/organizers.service';
import { PostalCodesService } from '@/core/services/postal-codes.service';
import { VenuesService } from '@/core/services/venues.service';
import { CreateEvent, toOffsetDateTime } from './create-event';

const VENUE: VenuesSummaryDto = {
  id: 'v-1',
  name: 'Dongo Circolo',
  address: 'Via Lario 4',
  cityName: 'Dongo',
  latitude: 46.12,
  longitude: 9.28,
};

const CITY: CityDto = {
  id: 1,
  name: 'Milano',
  province: 'Milano',
  region: 'Lombardia',
  country: 'Italia',
  latitude: 45.4642,
  longitude: 9.19,
  slug: 'milano',
  isActive: true,
};

const VERIFIED_ORGANIZER: OrganizerDetailDto = {
  id: 'org-ok',
  name: 'Milonga Porto',
  slug: 'milonga-porto',
  type: 'CLUB',
  description: null,
  logoUrl: null,
  website: null,
  phone: null,
  contactEmail: null,
  instagram: null,
  facebook: null,
  verified: true,
  claimed: true,
};

const UNVERIFIED_ORGANIZER: OrganizerDetailDto = {
  ...VERIFIED_ORGANIZER,
  id: 'org-no',
  name: 'Organizer in attesa',
  verified: false,
};

const DETAIL: OrganizerEventDetailDto = {
  id: 'evt-1',
} as unknown as OrganizerEventDetailDto;

/** Il componente usa protected per lo stato di template: nel test si accede via questo cast tipato. */
interface TestView {
  verifiedOrganizers: () => OrganizerDetailDto[];
  noVerifiedOrganizers: () => boolean;
  loadFailed: () => boolean;
  venues: { set: (venues: VenuesSummaryDto[]) => void };
  postalCodes: () => string[];
  buildDto: () => EventCreateDto;
  submit: () => void;
  onCityChange: (cityId: string | null | undefined) => void;
  toggleStyle: (id: number) => void;
  events: { createEvent: ReturnType<typeof vi.fn> };
  router: { navigate: ReturnType<typeof vi.fn> };
  form: {
    patchValue: (value: Record<string, unknown>) => void;
    invalid: boolean;
    hasError: (code: string) => boolean;
    controls: Record<
      'organizerId' | 'cityId' | 'venueId' | 'price' | 'address' | 'postalCode' | 'startAt',
      {
        value: unknown;
        valid: boolean;
        invalid: boolean;
        setValue: (value: unknown) => void;
        hasError: (code: string) => boolean;
      }
    >;
  };
}

function asTest(component: CreateEvent): TestView {
  return component as unknown as TestView;
}

interface SetupOptions {
  organizers?: OrganizerDetailDto[];
  cities?: CityDto[];
  postalCodes?: string[];
  failLoad?: boolean;
}

async function setup(options: SetupOptions = {}) {
  TestBed.configureTestingModule({ imports: [CreateEvent], providers: [provideRouter([])] });
  TestBed.overrideProvider(OrganizersService, {
    useValue: {
      getMyOrganizers: () =>
        options.failLoad ? throwError(() => new Error('boom')) : of(options.organizers ?? []),
    },
  });
  TestBed.overrideProvider(CitiesService, {
    useValue: { getCities: () => of(options.cities ?? []) },
  });
  TestBed.overrideProvider(DanceStylesService, {
    useValue: { getDanceStyles: () => of<DanceStyleDto[]>([]) },
  });
  TestBed.overrideProvider(VenuesService, {
    useValue: { listByCity: () => of<VenuesSummaryDto[]>([]) },
  });
  TestBed.overrideProvider(PostalCodesService, {
    useValue: { getByMunicipality: () => of(options.postalCodes ?? []) },
  });
  TestBed.overrideProvider(EventsService, {
    useValue: { createEvent: vi.fn(() => of(DETAIL)), getManageableEventDetail: vi.fn() },
  });

  // Spy sul Router reale di provideRouter([]): l'override con un falso
  // romperebbe i provider interni del router usati da RouterLink nel navbar.
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const fixture = TestBed.createComponent(CreateEvent);
  const component = asTest(fixture.componentInstance);
  // Il componente tiene la stessa istanza di Router: lo spy già la copre.
  return { fixture, component, navigate };
}

describe('CreateEvent', () => {
  it("toOffsetDateTime converte datetime-local in OffsetDateTime con l'offset locale", () => {
    const iso = toOffsetDateTime('2026-09-20T22:00');
    expect(iso).toMatch(/^2026-09-20T22:00:00[+-]\d{2}:\d{2}$/);
  });

  it("esclude gli organizers non verificati e preseleziona l'unico verificato", async () => {
    const { component } = await setup({ organizers: [UNVERIFIED_ORGANIZER, VERIFIED_ORGANIZER] });
    expect(component.verifiedOrganizers()).toEqual([VERIFIED_ORGANIZER]);
    expect(component.form.controls.organizerId.value).toBe(VERIFIED_ORGANIZER.id);
  });

  it('blocca il form se non esiste nessun organizer verificato', async () => {
    const { component } = await setup({ organizers: [UNVERIFIED_ORGANIZER] });
    expect(component.noVerifiedOrganizers()).toBe(true);
  });

  it('segna il caricamento come fallito se gli organizers non arrivano', async () => {
    const { component } = await setup({ failLoad: true });
    expect(component.loadFailed()).toBe(true);
  });

  it('un evento gratuito mappa a free: true e price: null (mai isFree)', async () => {
    const { component } = await setup();
    component.form.patchValue({
      organizerId: 'org-ok',
      title: 'Milonga del porto',
      eventType: 'EVENT',
      cityId: '2',
      address: 'Via del Porto 1',
      postalCode: '20121',
      startAt: '2026-09-20T22:00',
      endAt: '2026-09-21T02:00',
      free: true,
      price: 15, // prezzo precompilato ma ignorato perché gratuito
    });
    const dto = component.buildDto();
    expect(dto.free).toBe(true);
    expect(dto.price).toBeNull();
    expect(dto.currency).toBe('EUR');
    expect(Object.keys(dto)).toContain('free');
    expect(Object.keys(dto)).not.toContain('isFree');
  });

  it('un evento a pagamento manda price >= 0 e le date come OffsetDateTime', async () => {
    const { component } = await setup();
    component.form.patchValue({
      organizerId: 'org-ok',
      title: 'Milonga del porto',
      eventType: 'EVENT',
      cityId: '2',
      address: 'Via del Porto 1',
      postalCode: '20121',
      startAt: '2026-09-20T22:00',
      endAt: '2026-09-21T02:00',
      free: false,
      price: 15,
    });
    const dto = component.buildDto();
    expect(dto.free).toBe(false);
    expect(dto.price).toBe(15);
    expect(dto.startAt).toMatch(/^2026-09-20T22:00:00[+-]\d{2}:\d{2}$/);
    expect(dto.endAt > dto.startAt).toBe(true);
  });

  it('senza venue il JSON non include flyerUrl, seriesId, latitude o longitude', async () => {
    const { component } = await setup();
    const dto = component.buildDto() as unknown as Record<string, unknown>;
    for (const key of ['flyerUrl', 'seriesId', 'latitude', 'longitude']) {
      expect(Object.keys(dto)).not.toContain(key);
    }
  });

  it("con venue scelto manda venueId e l'indirizzo del venue; senza venue manda venueId: null", async () => {
    const { component } = await setup();
    component.form.patchValue({
      organizerId: 'org-ok',
      title: 'Milonga del porto',
      eventType: 'EVENT',
      cityId: '2',
      address: 'Via del Porto 1',
      postalCode: '20121',
      startAt: '2026-09-20T22:00',
      endAt: '2026-09-21T02:00',
      free: true,
    });

    component.form.controls.venueId.setValue('');
    const withoutVenue = component.buildDto();
    expect(withoutVenue.venueId).toBeNull();
    expect(withoutVenue.address).toBe('Via del Porto 1, 20121');

    component.venues.set([VENUE]);
    component.form.controls.venueId.setValue(VENUE.id);
    const withVenue = component.buildDto();
    expect(withVenue.venueId).toBe(VENUE.id);
    expect(withVenue.address).toBe(VENUE.address);
    expect(withVenue.latitude).toBe(VENUE.latitude);
    expect(withVenue.longitude).toBe(VENUE.longitude);
  });

  it("blocca l'invio se endAt non viene dopo startAt", async () => {
    const { component } = await setup();
    component.form.patchValue({
      organizerId: 'org-ok',
      title: 'Milonga del porto',
      eventType: 'EVENT',
      cityId: '2',
      address: 'Via del Porto 1',
      postalCode: '20121',
      startAt: '2026-09-20T22:00',
      endAt: '2026-09-20T22:00',
      free: true,
    });
    expect(component.form.invalid).toBe(true);
    expect(component.form.hasError('endBeforeStart')).toBe(true);
  });

  it("blocca l'invio se startAt non è più nel futuro", async () => {
    const { component } = await setup();
    component.form.patchValue({
      organizerId: 'org-ok',
      title: 'Milonga del porto',
      eventType: 'EVENT',
      cityId: '2',
      address: 'Via del Porto 1',
      postalCode: '20121',
      startAt: '2020-01-01T22:00',
      endAt: '2020-01-02T02:00',
      free: true,
    });

    component.submit();

    expect(component.form.controls.startAt.hasError('future')).toBe(true);
    expect(component.events.createEvent).not.toHaveBeenCalled();
  });

  it("richiede il prezzo quando l'evento è a pagamento", async () => {
    const { component } = await setup();
    component.form.patchValue({ free: false });
    expect(component.form.controls.price.invalid).toBe(true);
  });

  it("richiede l'indirizzo libero solo se non è stato scelto un venue", async () => {
    const { component } = await setup();
    component.form.controls.cityId.setValue('2');
    expect(component.form.controls.address.invalid).toBe(true);

    component.venues.set([VENUE]);
    component.form.controls.venueId.setValue(VENUE.id);
    expect(component.form.controls.address.valid).toBe(true);
    expect(component.form.controls.postalCode.valid).toBe(true);
  });

  it('propone i CAP del comune selezionato e preseleziona quello unico', async () => {
    const { component } = await setup({ cities: [CITY], postalCodes: ['20121'] });
    component.form.controls.cityId.setValue('1');

    component.onCityChange('1');

    expect(component.postalCodes()).toEqual(['20121']);
    expect(component.form.controls.postalCode.value).toBe('20121');
  });

  it("invia il POST con la chiave free e naviga alla fase 2 con l'ID dell'evento", async () => {
    const { component } = await setup();
    component.form.patchValue({
      organizerId: 'org-ok',
      title: 'Milonga del porto',
      eventType: 'EVENT',
      cityId: '2',
      address: 'Via del Porto 1',
      postalCode: '20121',
      startAt: '2026-09-20T22:00',
      endAt: '2026-09-21T02:00',
      free: true,
    });

    component.submit();

    expect(component.events.createEvent).toHaveBeenCalledOnce();
    const sent = component.events.createEvent.mock.calls[0][0] as Record<string, unknown>;
    expect(sent['free']).toBe(true);
    expect(sent['currency']).toBe('EUR');
    expect(component.router.navigate).toHaveBeenCalledWith([
      '/organizer/events',
      'evt-1',
      'publish',
    ]);
  });

  it('non invia nulla se il form è invalido', async () => {
    const { component } = await setup();
    component.submit();
    expect(component.form.invalid).toBe(true);
    expect(component.events.createEvent).not.toHaveBeenCalled();
  });

  it('gli stili di ballo selezionati finiscono in danceStyleIds', async () => {
    const { component } = await setup();
    component.toggleStyle(3);
    component.toggleStyle(7);
    component.toggleStyle(3);
    expect(component.buildDto().danceStyleIds).toEqual([7]);
  });
});
