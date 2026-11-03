import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { VenueDetailDto, VenuesSummaryDto } from '../../../../core/models/venue.model';
import { CitiesService } from '../../../../core/services/cities.service';
import { VenuesService } from '../../../../core/services/venues.service';
import { ExistingVenuePicker } from './existing-venue-picker';

const VENUE = { id: 'v1', name: 'Sala Havana', address: 'Via Roma 1', cityName: 'Milano' } as VenuesSummaryDto;

describe('ExistingVenuePicker', () => {
  let fixture: ComponentFixture<ExistingVenuePicker>;
  let picked: VenuesSummaryDto[];
  let searches: [number, string | undefined][];
  let detail: () => Observable<Partial<VenueDetailDto>>;

  const element = () => fixture.nativeElement as HTMLElement;
  const wait = async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await fixture.whenStable();
  };
  const type = async (name: string) => {
    const input = element().querySelector<HTMLInputElement>('input[type=search]')!;
    input.value = name;
    input.dispatchEvent(new Event('input'));
    await wait();
  };
  const result = () => element().querySelector<HTMLButtonElement>('ul button')!;

  beforeEach(async () => {
    picked = [];
    searches = [];
    detail = () => of({ organizerId: null, organizerName: null });
    TestBed.configureTestingModule({
      providers: [
        { provide: CitiesService, useValue: { getCities: () => of([{ id: 7, name: 'Milano' }, { id: 8, name: 'Bergamo' }]) } },
        {
          provide: VenuesService,
          useValue: {
            getVenues: (city: number, name?: string) => {
              searches.push([city, name]);
              return of([VENUE]);
            },
            getVenueDetail: () => detail(),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(ExistingVenuePicker);
    fixture.componentRef.setInput('requestId', 'r1');
    fixture.componentRef.setInput('cityName', 'Milano');
    fixture.componentInstance.picked.subscribe((venue) => picked.push(venue));
    await fixture.whenStable();
  });

  it('searches the request\'s city, from 2 letters', async () => {
    await type('S');
    expect(searches).toEqual([]);

    await type('Sala');
    expect(searches).toEqual([[7, 'Sala']]);
    expect(result().textContent).toContain('Sala Havana');
  });

  it('hands over a free venue', async () => {
    await type('Sala');
    result().click();
    expect(picked).toEqual([VENUE]);
  });

  it('refuses a venue that already has an organizer', async () => {
    detail = () => of({ organizerId: 'o1', organizerName: 'Tropical' });
    await type('Sala');
    result().click();
    await fixture.whenStable();
    expect(picked).toEqual([]);
    expect(element().textContent).toContain('già collegato a Tropical');
  });

  it('says so if the venue cannot be checked', async () => {
    detail = () => throwError(() => new Error('down'));
    await type('Sala');
    result().click();
    await fixture.whenStable();
    expect(picked).toEqual([]);
    expect(element().textContent).toContain('Non siamo riusciti');
  });
});
