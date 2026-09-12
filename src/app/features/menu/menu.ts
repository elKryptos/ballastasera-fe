import { Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navbar } from '../../shared/navbar/navbar';
import { AuthService } from '../../core/services/auth.service';
import { EventsService, MapBounds } from '../../core/services/events.service';
import { EventType } from '../../core/models/event.model';

/**
 * Rough bounding box around Milano — wide enough to catch every event in the
 * only city the app currently supports — just to count how many are live
 * right now for the Mappa card's badge. Swap for a real "count live events"
 * endpoint (or a per-city box) once the backend has multi-city support.
 */
const MILANO_BOUNDS: MapBounds = {
  minLat: 45.35,
  maxLat: 45.56,
  minLng: 9.0,
  maxLng: 9.35,
};

interface ComingSoonItem {
  icon: 'calendar' | 'bell' | 'user';
  title: string;
}

/** A pin on the decorative background map, in % of the card — same four
 * types (and icons) as the real map markers (see map.ts's PIN_SHAPES). */
interface MapDot {
  x: number;
  y: number;
  type: EventType;
}

/**
 * Hub post-login: da qui l'utente sceglie cosa fare. Ogni login atterra qui
 * (vedi Oauth2Callback.postLoginUrl e Welcome.enter()). Solo la mappa è
 * collegata per ora — le altre sono tile "prossimamente", non cliccabili.
 */
@Component({
  selector: 'app-menu',
  templateUrl: './menu.html',
  styleUrl: './menu.css',
  imports: [Navbar, RouterLink],
})
export class Menu {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly auth = inject(AuthService);
  private readonly eventsService = inject(EventsService);

  protected readonly firstName = computed(() => this.auth.currentUser()?.displayName.split(' ')[0] ?? '');

  /** null finché la chiamata non torna (o se fallisce) — il badge resta nascosto invece di mostrare 0. */
  protected readonly liveCount = signal<number | null>(null);

  protected readonly comingSoon: ComingSoonItem[] = [
    { icon: 'calendar', title: 'Eventi' },
    { icon: 'bell', title: 'Notifiche' },
    { icon: 'user', title: 'Profilo' },
  ];

  /** Decorative only — positioned over the static map image in
   * public/menu/map-preview.jpg, not tied to any real event. */
  protected readonly mapDots: MapDot[] = [
    { x: 15, y: 30, type: 'EVENT' },
    { x: 58, y: 18, type: 'SCHOOL' },
    { x: 40, y: 40, type: 'CLUB' },
    { x: 90, y: 20, type: 'BAR' },
  ];

  /** Same palette as the real map markers — see map.ts's PIN_COLORS. */
  private readonly pinColors: Record<EventType, string> = {
    EVENT: 'var(--color-rose)',
    SCHOOL: 'var(--color-violet)',
    CLUB: 'var(--color-mint)',
    BAR: 'var(--color-amber)',
  };

  protected pinColor(type: EventType): string {
    return this.pinColors[type];
  }

  constructor() {
    // Solo client: stesso motivo di MapPage — la HTTP transfer cache non
    // aggancia questa chiamata, quindi farla in SSR vorrebbe dire farla due volte.
    if (this.isBrowser) {
      this.eventsService.getMapEvents(MILANO_BOUNDS).subscribe({
        next: (events) => this.liveCount.set(events.filter((event) => event.liveNow).length),
        error: () => this.liveCount.set(null),
      });
    }
  }
}
