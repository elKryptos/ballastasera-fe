import { Service, inject, signal } from '@angular/core';
import { Observable, finalize, map, of, shareReplay, tap } from 'rxjs';
import { CityDto } from '../models/city.model';
import { EventCardDto } from '../models/event.model';
import { cityBounds } from '../utils/geo';
import { EventsService } from './events.service';

/** Coming back to /lista within this window reuses what's here instead of
 * asking again — the day and style chips filter it client-side anyway. */
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface CityEvents {
  events: EventCardDto[];
  /** The backend hit its cap (MAP_LIMIT): the latest events may be missing. */
  truncated: boolean;
  fetchedAt: number;
}

/**
 * Every live or upcoming event of a city, for /lista: one request per city
 * (the backend has no city-only endpoint, so it's the city's box plus its
 * id), cached for CACHE_TTL_MS. A signal store rather than a plain cache so a
 * like on the list (or the map) can patch the counts in place — see
 * adjustCount.
 */
@Service()
export class CityEventsService {
  private readonly eventsService = inject(EventsService);

  private readonly store = signal<ReadonlyMap<number, CityEvents>>(new Map());
  readonly entries = this.store.asReadonly();
  /** Requests in flight, so two callers asking at once share one. */
  private readonly pending = new Map<number, Observable<CityEvents>>();

  load(city: CityDto, { force = false } = {}): Observable<CityEvents> {
    const cached = this.store().get(city.id);
    if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return of(cached);

    const inFlight = this.pending.get(city.id);
    if (inFlight) return inFlight;

    const request = this.eventsService.getMapEvents(cityBounds(city), city.id).pipe(
      map(({ events, truncated }) => ({ events, truncated, fetchedAt: Date.now() })),
      tap((entry) => this.store.update((store) => new Map(store).set(city.id, entry))),
      finalize(() => this.pending.delete(city.id)),
      shareReplay(1),
    );
    this.pending.set(city.id, request);
    return request;
  }

  /** Optimistic +1/-1 on a cached event's count, wherever it's cached. */
  adjustCount(eventId: string, field: 'likesCount' | 'goingCount', delta: number): void {
    this.store.update((store) => {
      const next = new Map(store);
      for (const [cityId, entry] of store) {
        if (!entry.events.some((event) => event.id === eventId)) continue;
        next.set(cityId, {
          ...entry,
          events: entry.events.map((event) =>
            event.id === eventId ? { ...event, [field]: Math.max(0, event[field] + delta) } : event,
          ),
        });
      }
      return next;
    });
  }
}
