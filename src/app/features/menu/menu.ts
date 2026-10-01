import { Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navbar } from '../../shared/navbar/navbar';
import { AuthService } from '../../core/services/auth.service';
import { EventsService, MapBounds } from '../../core/services/events.service';
import { EventCardDto, EventType } from '../../core/models/event.model';
import {
  addressPrimary,
  formatClock,
  formatPrice,
  formatTimeRange,
  withoutCountry,
} from '../../core/utils/event-format';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { MapSnapshot } from '../../shared/map-snapshot/map-snapshot';

/**
 * Rough bounding box around Milano wide enough to catch every event in the
 * only city the app currently supports — feeds the Mappa card's live badge
 * and counts and the Stasera carousel. Swap for a real "events in this city"
 * endpoint (no bounds needed) once the backend has one.
 */
const MILANO_BOUNDS: MapBounds = {
  minLat: 45.35,
  maxLat: 45.56,
  minLng: 9.0,
  maxLng: 9.35,
};

/** A night out runs past midnight: anything starting before this hour of
 * the next morning still counts as "stasera". */
const NIGHT_ENDS_AT_HOUR = 6;

function tonightCutoff(now: Date): number {
  const cutoff = new Date(now);
  if (now.getHours() >= NIGHT_ENDS_AT_HOUR) cutoff.setDate(cutoff.getDate() + 1);
  cutoff.setHours(NIGHT_ENDS_AT_HOUR, 0, 0, 0);
  return cutoff.getTime();
}

/** One card of the "Stasera" carousel, already formatted for the template. */
interface TonightCard {
  id: string;
  title: string;
  live: boolean;
  /** "Live · fino alle 01:20" while live, the start-end range otherwise. */
  when: string;
  place: string;
  price: string;
  going: number;
}

/** Same palette as the real map markers — see map.ts's PIN_COLORS. */
const PIN_COLORS: Record<EventType, string> = {
  EVENT: 'var(--color-rose)',
  SCHOOL: 'var(--color-violet)',
  CLUB: 'var(--color-mint)',
  BAR: 'var(--color-amber)',
};

/** A pin on the decorative background map, in % of the card same four
 * types (and icons) as the real map markers (see map.ts's PIN_SHAPES). */
interface MapDot {
  x: number;
  y: number;
  type: EventType;
  color: string;
}

/**
 * Hub post-login: da qui l'utente sceglie cosa fare. Ogni login atterra qui
 * (vedi Oauth2Callback.postLoginUrl e Welcome.enter()). Collegate per ora:
 * la mappa e le card di stasera; le scorciatoie e la barra in basso (tranne
 * Mappa) sono già al loro posto ma aspettano le loro pagine.
 */
@Component({
  selector: 'app-menu',
  templateUrl: './menu.html',
  styleUrl: './menu.css',
  imports: [Navbar, RouterLink, SidebarPushDirective, MapSnapshot],
})
export class Menu {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly auth = inject(AuthService);
  private readonly eventsService = inject(EventsService);

  protected readonly firstName = computed(() => this.auth.currentUser()?.displayName.split(' ')[0] ?? '');

  /** null finché la chiamata non torna (o se fallisce). */
  private readonly events = signal<EventCardDto[] | null>(null);
  protected readonly eventsFailed = signal(false);

  /** null finché la chiamata non torna (o se fallisce) — il badge resta nascosto invece di mostrare 0. */
  protected readonly liveCount = computed(() => this.events()?.filter((event) => event.liveNow).length ?? null);

  /** Same Milano box as liveCount, until the backend has a "tonight in this
   * city" endpoint that doesn't need one — live first, then by start time. */
  protected readonly tonight = computed<TonightCard[] | null>(() => {
    const events = this.events();
    if (!events) return null;

    const cutoff = tonightCutoff(new Date());
    return events
      .filter((event) => new Date(event.startAt).getTime() < cutoff)
      .sort(
        (a, b) =>
          Number(b.liveNow) - Number(a.liveNow) || new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      )
      .map((event) => ({
        id: event.id,
        title: event.title,
        live: event.liveNow,
        when: event.liveNow ? `Live · fino alle ${formatClock(event.endAt)}` : formatTimeRange(event),
        place: event.venueName ?? addressPrimary(withoutCountry(event.address)),
        price: formatPrice(event),
        going: event.goingCount,
      }));
  });

  /** "4 serate stasera · 1 in corso" under the Mappa card's title. */
  protected readonly mapSummary = computed(() => {
    const tonight = this.tonight();
    const live = this.liveCount();
    if (!tonight || live === null) return null;

    const nights = `${tonight.length} ${tonight.length === 1 ? 'serata' : 'serate'} stasera`;
    return live > 0 ? `${nights} · ${live} in corso` : nights;
  });

  /** No list page behind these yet — shown, not linked. */
  protected readonly shortcuts = ['Domani', 'Weekend', 'Scuole e locali'];

  /** Decorative only positioned over the card's map picture (MapSnapshot),
   * not tied to any real event. */
  protected readonly mapDots: MapDot[] = (
    [
      { x: 16, y: 72, type: 'EVENT' },
      { x: 58, y: 18, type: 'SCHOOL' },
      { x: 40, y: 40, type: 'CLUB' },
      { x: 90, y: 20, type: 'BAR' },
    ] as const
  ).map((dot) => ({ ...dot, color: PIN_COLORS[dot.type] }));

  constructor() {
    // Solo client: stesso motivo di MapPage la HTTP transfer cache non
    // aggancia questa chiamata, quindi farla in SSR vorrebbe dire farla due volte.
    if (this.isBrowser) {
      this.eventsService.getMapEvents(MILANO_BOUNDS).subscribe({
        next: ({ events }) => this.events.set(events),
        error: () => this.eventsFailed.set(true),
      });
    }
  }
}
