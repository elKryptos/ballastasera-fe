import { Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { FEATURE_FLAGS } from '../../core/config/feature-flags';
import { EventsService } from '../../core/services/events.service';
import { ALL_PLACES_QUERY, MILAN_CENTER } from '../../core/config/map-pins';
import { cityBounds } from '../../core/utils/geo';
import { EventCardDto, EventType } from '../../core/models/event.model';
import {
  addressPrimary,
  formatClock,
  formatPrice,
  formatTimeRange,
  withoutCountry,
} from '../../core/utils/event-format';
import { compareByLiveThenStart, inDateRange } from '../../core/utils/event-filters';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { EventPinIcon } from '../../shared/event-filters/pin-icons';
import { MapSnapshot } from '../../shared/map-snapshot/map-snapshot';

/**
 * Milano and its province — the same box /lista asks for (cityBounds), so the
 * menu counts the same nights — in the only city the app currently supports.
 * Feeds the Mappa card's live badge and counts and the Stasera carousel. Swap
 * for a real "events in this city" endpoint (no bounds needed) once the
 * backend has one.
 */
const MILANO_BOUNDS = cityBounds({ latitude: MILAN_CENTER[0], longitude: MILAN_CENTER[1] });

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
  /** No flyer: the type's pin stands in, as on the map's and the list's cards. */
  flyerUrl: string | null;
  eventType: EventType;
}

/** A pin on the decorative background map, in % of the card — drawn by
 * EventPinIcon, so it's the real map's pin for that type. */
interface MapDot {
  x: number;
  y: number;
  type: EventType;
}

/** One row of "Non solo stasera": a list, already searched. */
interface Shortcut {
  label: string;
  hint: string;
  /** Which picture its tile shows (menu.html). */
  icon: 'tomorrow' | 'weekend' | 'venues';
  /** null while its page is off (feature flag): shown, not linked. */
  path: string | null;
  query: Record<string, string>;
}

/**
 * Hub post-login: da qui l'utente sceglie cosa fare. Ogni login atterra qui
 * (vedi Oauth2Callback.postLoginUrl e Welcome.enter()). Collegate: la mappa,
 * le card di stasera e — con /lista e /scuole accese — "Vedi tutte" e le
 * scorciatoie. Il resto (Impara a ballare, il profilo) è nella sidebar.
 */
@Component({
  selector: 'app-menu',
  templateUrl: './menu.html',
  imports: [RouterLink, SidebarPushDirective, MapSnapshot, EventPinIcon],
  host: { class: 'block min-h-dvh bg-(--color-ink) text-(--ev-text)' },
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
   * city" endpoint that doesn't need one. Tonight and its order as on /lista
   * and the map (event-filters): live first, then by start time. */
  protected readonly tonight = computed<TonightCard[] | null>(() => {
    const events = this.events();
    if (!events) return null;

    const now = Date.now();
    return events
      .filter((event) => inDateRange(event, 'tonight', now))
      .sort((a, b) => compareByLiveThenStart(a, b, now))
      .map((event) => ({
        id: event.id,
        title: event.title,
        live: event.liveNow,
        when: event.liveNow ? `Live · fino alle ${formatClock(event.endAt)}` : formatTimeRange(event),
        place: event.venueName ?? addressPrimary(withoutCountry(event.address)),
        price: formatPrice(event),
        going: event.goingCount,
        flyerUrl: event.flyerUrl,
        eventType: event.eventType,
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

  private readonly flags = inject(FeatureFlagService);

  /** /lista, while it's on (feature flag): "Vedi tutte" and the days below
   * lead there; otherwise (null) they're shown, not linked. */
  protected readonly listPath = this.flags.isEnabled(FEATURE_FLAGS.eventListPage) ? '/lista' : null;

  /** Domani and Weekend: straight to the list's search for that day — see
   * EventList, which reads ?quando once. "Scuole e locali": every place on
   * /scuole, not only its schools (ALL_PLACES_QUERY) — the same places as the
   * map's "Locali e scuole". */
  protected readonly shortcuts: Shortcut[] = [
    { label: 'Domani', hint: 'Le serate di domani', icon: 'tomorrow', path: this.listPath, query: { quando: 'domani' } },
    { label: 'Weekend', hint: 'Venerdì, sabato e domenica', icon: 'weekend', path: this.listPath, query: { quando: 'weekend' } },
    {
      label: 'Scuole e locali',
      hint: 'Scuole, discoteche e bar della città',
      icon: 'venues',
      path: this.flags.isEnabled(FEATURE_FLAGS.schoolListPage) ? '/scuole' : null,
      query: ALL_PLACES_QUERY,
    },
  ];

  /** Decorative only positioned over the card's map picture (MapSnapshot),
   * not tied to any real event. y is the pin's tip: low enough that the
   * whole pin stays on the picture, clear of the LIVE badge. */
  protected readonly mapDots: MapDot[] = [
    { x: 28, y: 62, type: 'EVENT' },
    { x: 58, y: 32, type: 'SCHOOL' },
    { x: 46, y: 82, type: 'CLUB' },
    { x: 86, y: 52, type: 'BAR' },
  ];

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
