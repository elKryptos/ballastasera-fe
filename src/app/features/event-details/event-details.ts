import { Component, DestroyRef, PLATFORM_ID, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { Location, NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideBadgeCheck,
  lucideCheck,
  lucideCircleCheck,
  lucideClock,
  lucideGlobe,
  lucideHeart,
  lucideInstagram,
  lucideMapPin,
  lucideMaximize2,
  lucideShare2,
  lucideUsers,
  lucideX,
} from '@ng-icons/lucide';
import { environment } from '../../../environments/environment';
import { EVENT_TYPE_LABELS, PIN_COLORS, PIN_GLYPHS, PIN_SHAPES } from '../../core/config/map-pins';
import { MapViewStateService } from '../../core/services/map-view-state.service';
import { Navbar } from '../../shared/navbar/navbar';
import { AuthModal } from '../../shared/auth-modal/auth-modal';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { EventsService } from '../../core/services/events.service';
import { AuthService } from '../../core/services/auth.service';
import { EventDetailDto } from '../../core/models/event.model';
import { OrganizerDetailDto, OrganizerType } from '../../core/models/organizer.model';
import {
  addressPrimary,
  addressSecondary,
  formatPrice,
  googleMapsUrl,
  instagramUrl,
  isLiveAt,
  minutesToStart,
} from '../../core/utils/event-format';

/** Zoom level of the static mini-map in the "Dove" card — street level, enough
 * to read the surrounding streets without being a full interactive map. */
const MINI_MAP_ZOOM = 16;
const TILE_SIZE = 256;

/** One CARTO tile of the mini-map, placed inside a 3x3 grid (768x768 px). */
interface MiniMapTile {
  light: string;
  dark: string;
  left: number;
  top: number;
}

/** 3x3 tile grid around the event plus the event's pixel position inside it,
 * so the template can shift the grid until that point sits at the card's
 * centre (where the pin is drawn) whatever the card's width. */
interface MiniMap {
  tiles: MiniMapTile[];
  offsetX: number;
  offsetY: number;
}

const ORGANIZER_TYPE_LABELS: Record<OrganizerType, string> = {
  PERSON: 'Organizzatore',
  VENUE: 'Locale',
  CLUB: 'Discoteca',
  SCHOOL: 'Scuola',
  ASSOCIATION: 'Associazione',
};

@Component({
  selector: 'app-event-details',
  templateUrl: './event-details.html',
  styleUrl: './event-details.css',
  imports: [Navbar, AuthModal, SidebarPushDirective, NgIcon, NgTemplateOutlet],
  // On the document, not the lightbox <div>: that div never holds focus, so a
  // keydown listener on it would never fire.
  host: { '(document:keydown.escape)': 'closeFlyer()' },
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideBadgeCheck,
      lucideCheck,
      lucideCircleCheck,
      lucideClock,
      lucideGlobe,
      lucideHeart,
      lucideInstagram,
      lucideMapPin,
      lucideMaximize2,
      lucideShare2,
      lucideUsers,
      lucideX,
    }),
  ],
})
export class EventDetails {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly mapViewState = inject(MapViewStateService);
  private readonly eventsService = inject(EventsService);
  private readonly authService = inject(AuthService);

  protected readonly event = signal<EventDetailDto | null>(null);
  protected readonly loading = signal(true);

  /** Opens the shared login dialog when a signed-out visitor taps
   * Parteciperò/Mi piace — both require a session server-side (same pattern
   * as map.ts). */
  protected readonly authOpen = signal(false);
  protected readonly going = signal(false);
  protected readonly liked = signal(false);
  /** No follow-organizer endpoint yet — local-only toggle. */
  protected readonly following = signal(false);

  /** Outline while not liked; filled with --ed-heart once liked — shared by
   * the "Mi piace" counter and both like buttons (which turn it white when
   * pressed, see the template). lucideHeart's <svg> hardcodes fill="none" and
   * ng-icon has no input for it, so the fill goes on the inner svg via an
   * arbitrary variant. Same approach as heartIconClass in event-map-card.ts. */
  protected readonly heartIconClass = computed(() =>
    this.liked() ? 'text-(--ed-heart) [&_svg]:fill-current' : '',
  );
  /** Briefly swaps the share icon for a checkmark after copying the link
   * (clipboard fallback for browsers without navigator.share). */
  protected readonly linkCopied = signal(false);

  /** Fullscreen flyer lightbox: tap the hero to open, tap the image again to
   * toggle between fit-to-screen and full-size (pannable via scroll). */
  protected readonly flyerOpen = signal(false);
  protected readonly flyerZoomed = signal(false);

  /** Static tiles for the "Dove" card, computed once when the event loads;
   * null when the event has no coordinates (the card then shows text only). */
  protected readonly miniMap = signal<MiniMap | null>(null);

  protected readonly formatPrice = formatPrice;
  protected readonly addressPrimary = addressPrimary;
  protected readonly addressSecondary = addressSecondary;
  protected readonly googleMapsUrl = googleMapsUrl;
  protected readonly instagramUrl = instagramUrl;

  /** Only the id, so the effect below doesn't refetch on every count change. */
  private readonly eventId = computed(() => this.event()?.id ?? null);
  private linkCopiedTimer: ReturnType<typeof setTimeout> | undefined;
  /** Toggles with a request still in flight — a second tap is ignored until
   * it settles, or add/remove could reach the server in the wrong order and
   * leave the button out of sync with the backend. */
  private readonly pendingToggles = new Set<WritableSignal<boolean>>();

  /** Ticks once a minute (browser only) so the live/soon badge moves on by
   * itself — "Inizia tra 5 min" → "LIVE ORA" — while the page stays open.
   * Purely local: startAt/endAt are already loaded, no backend calls. */
  private readonly now = signal(Date.now());

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Same body-scroll lock as auth-modal.ts, DOM-only hence the platform
    // check — released on destroy too, or leaving the page with the lightbox
    // open would keep every other page unscrollable.
    effect(() => {
      if (!this.isBrowser) return;
      document.body.style.overflow = this.flyerOpen() ? 'hidden' : '';
    });
    const clock = this.isBrowser ? setInterval(() => this.now.set(Date.now()), 60_000) : undefined;
    destroyRef.onDestroy(() => {
      if (this.isBrowser) document.body.style.overflow = '';
      clearTimeout(this.linkCopiedTimer);
      clearInterval(clock);
    });

    // Parteciperò/Mi piace state follows the session, not just the first
    // load: signing in from the auth modal fetches it, signing out clears it.
    effect(() => {
      const id = this.eventId();
      if (!id || !this.authService.isAuthenticated()) {
        this.going.set(false);
        this.liked.set(false);
        return;
      }
      // On failure (e.g. expired session) the buttons just stay unpressed.
      this.eventsService.isGoing(id).subscribe({
        next: (active) => this.going.set(active),
        error: () => this.going.set(false),
      });
      this.eventsService.isFavorite(id).subscribe({
        next: (active) => this.liked.set(active),
        error: () => this.liked.set(false),
      });
    });

    const id = this.route.snapshot.paramMap.get('id');
    // No id or a failed fetch both end with event() still null, which the
    // template already renders as "not found" — no separate error flag needed.
    if (!id) {
      this.loading.set(false);
      return;
    }

    this.eventsService.getEventDetail(id).subscribe({
      next: (event) => {
        this.event.set(event);
        this.miniMap.set(this.buildMiniMap(event));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Back only when there's an in-app page to return to. Opened straight from
   * a shared link, this page is the router's first navigation (navigationId
   * 1 in history.state) and location.back() would leave the app — or do
   * nothing in a fresh tab — so it goes to the map instead. */
  protected goBack(): void {
    const state = this.location.getState() as { navigationId?: number } | null;
    if ((state?.navigationId ?? 1) > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/mappa']);
    }
  }

  /** Opens /mappa centred on this event with its card already open — the
   * map reads both from MapViewStateService when it mounts (see
   * restoreSelectedEvent in map.ts). */
  protected openOnMap(event: EventDetailDto): void {
    if (event.latitude == null || event.longitude == null) return;
    this.mapViewState.center = [event.latitude, event.longitude];
    this.mapViewState.zoom = MINI_MAP_ZOOM;
    this.mapViewState.selectedEventId = event.id;
    this.router.navigate(['/mappa']);
  }

  protected toggleGoing(): void {
    const event = this.event();
    if (!event) return;

    this.toggleOptimistic(
      this.going,
      event.id,
      (id) => this.eventsService.addAttendance(id),
      (id) => this.eventsService.removeAttendance(id),
      (activating) => this.adjustCount('goingCount', activating ? 1 : -1),
    );
  }

  protected toggleLike(): void {
    const event = this.event();
    if (!event) return;

    this.toggleOptimistic(
      this.liked,
      event.id,
      (id) => this.eventsService.addFavorite(id),
      (id) => this.eventsService.removeFavorite(id),
      (activating) => this.adjustCount('likesCount', activating ? 1 : -1),
    );
  }

  protected toggleFollow(): void {
    this.following.update((active) => !active);
  }

  /** navigator.share on mobile browsers that support the native sheet;
   * falls back to copying the current URL to the clipboard. */
  protected async share(event: EventDetailDto): Promise<void> {
    if (!this.isBrowser) return;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, url });
      } catch {
        // User dismissed the native share sheet — nothing to do.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // No clipboard API (insecure context) or permission denied — nothing to show.
      return;
    }
    this.linkCopied.set(true);
    clearTimeout(this.linkCopiedTimer);
    this.linkCopiedTimer = setTimeout(() => this.linkCopied.set(false), 2000);
  }

  protected openFlyer(): void {
    this.flyerZoomed.set(false);
    this.flyerOpen.set(true);
  }

  protected closeFlyer(): void {
    this.flyerOpen.set(false);
  }

  protected toggleFlyerZoom(): void {
    this.flyerZoomed.update((zoomed) => !zoomed);
  }

  /** Shared by toggleGoing/toggleLike: flips local state immediately, fires
   * the matching add/remove request, and rolls back if it fails. Mirrors
   * EventEngagementService.toggleOptimistic, adapted to a single boolean instead of a Set. */
  private toggleOptimistic(
    stateSignal: WritableSignal<boolean>,
    id: string,
    add: (id: string) => Observable<void>,
    remove: (id: string) => Observable<void>,
    adjustCount: (activating: boolean) => void,
  ): void {
    if (!this.authService.isAuthenticated()) {
      this.authOpen.set(true);
      return;
    }
    if (this.pendingToggles.has(stateSignal)) return;

    const wasActive = stateSignal();
    stateSignal.set(!wasActive);
    adjustCount(!wasActive);
    this.pendingToggles.add(stateSignal);

    const request = wasActive ? remove(id) : add(id);
    request.subscribe({
      complete: () => this.pendingToggles.delete(stateSignal),
      error: () => {
        this.pendingToggles.delete(stateSignal);
        stateSignal.set(wasActive);
        adjustCount(wasActive);
      },
    });
  }

  private adjustCount(field: 'likesCount' | 'goingCount', delta: number): void {
    this.event.update((event) => (event ? { ...event, [field]: Math.max(0, event[field] + delta) } : event));
  }

  protected isLiveNow(event: EventDetailDto): boolean {
    return isLiveAt(event, this.now());
  }

  protected startsInMinutes(event: EventDetailDto): number | null {
    return minutesToStart(event, this.now());
  }

  /** Long form (e.g. "Venerdì 25 settembre 2026") — kept as its own method,
   * separate from formatTimeRange below, since the Quando row renders the
   * date and the start-end time on their own lines. */
  protected formatDate(event: EventDetailDto): string {
    const date = new Date(event.startAt).toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return date.charAt(0).toUpperCase() + date.slice(1);
  }

  /** Start-end range (both were sitting unused on EventDetailDto otherwise)
   * rather than just the start time, since these are club/party nights that
   * often run past midnight — knowing when it ends matters as much as when
   * it starts. */
  protected formatTimeRange(event: EventDetailDto): string {
    return `${this.formatClock(event.startAt)} – ${this.formatClock(event.endAt)}`;
  }

  /** hour12: false pinned explicitly rather than relying on it-IT's default
   * 24h clock — Intl's per-locale default can vary by runtime/ICU version,
   * and this page is Italy-only, so it's never meant to show AM/PM. */
  private formatClock(iso: string): string {
    return new Date(iso).toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  /** Second line under the "Dove" heading: with a venue name as the first
   * line, the whole address; otherwise just what's left after the street. */
  protected addressSubtitle(event: EventDetailDto): string | null {
    if (event.venueName) return event.address;
    return this.addressSecondary(event.address);
  }

  protected eventTypeLabel(event: EventDetailDto): string {
    return EVENT_TYPE_LABELS[event.eventType];
  }

  /** Same shape/glyph/colour as this event's pin on the real map, so the
   * mini-map in the "Dove" card reads as a crop of it. */
  protected pinShape(event: EventDetailDto): string {
    return PIN_SHAPES[event.eventType];
  }

  protected pinGlyph(event: EventDetailDto): string {
    return PIN_GLYPHS[event.eventType];
  }

  protected pinColor(event: EventDetailDto): string {
    return PIN_COLORS[event.eventType];
  }

  /** Web Mercator maths (same projection Leaflet uses) to pick the 3x3 block
   * of CARTO tiles around the event: Voyager for the light theme — the same
   * basemap as /mappa — and Dark Matter for the dark one. Plain <img> tiles
   * instead of a second Leaflet instance: the card is static, so it doesn't
   * need the library's JS chunk at all. */
  private buildMiniMap(event: EventDetailDto): MiniMap | null {
    if (event.latitude == null || event.longitude == null) return null;

    const scale = TILE_SIZE * 2 ** MINI_MAP_ZOOM;
    const latRad = (event.latitude * Math.PI) / 180;
    const x = ((event.longitude + 180) / 360) * scale;
    const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;

    const firstTileX = Math.floor(x / TILE_SIZE) - 1;
    const firstTileY = Math.floor(y / TILE_SIZE) - 1;
    const subdomains = ['a', 'b', 'c', 'd'];
    const tiles: MiniMapTile[] = [];

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const tileX = firstTileX + col;
        const tileY = firstTileY + row;
        const s = subdomains[(tileX + tileY) % subdomains.length];
        const path = `${MINI_MAP_ZOOM}/${tileX}/${tileY}@2x.png?key=${environment.cartoApiKey}`;
        tiles.push({
          light: `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/${path}`,
          dark: `https://${s}.basemaps.cartocdn.com/dark_all/${path}`,
          left: col * TILE_SIZE,
          top: row * TILE_SIZE,
        });
      }
    }

    return { tiles, offsetX: x - firstTileX * TILE_SIZE, offsetY: y - firstTileY * TILE_SIZE };
  }

  protected organizerTypeLabel(organizer: OrganizerDetailDto): string {
    return ORGANIZER_TYPE_LABELS[organizer.type];
  }

  /** Two-letter fallback avatar for organizers without a logoUrl. */
  protected organizerInitials(organizer: OrganizerDetailDto): string {
    return organizer.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join('');
  }
}
