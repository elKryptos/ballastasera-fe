import { Component, DestroyRef, PLATFORM_ID, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
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
import { WHATSAPP_PATH } from '../../core/config/brand-icons';
import { EVENT_TYPE_LABELS } from '../../core/config/map-pins';
import { injectGoBack } from '../../core/routing/go-back';
import { MapViewStateService } from '../../core/services/map-view-state.service';
import { AuthModal } from '../../shared/auth-modal/auth-modal';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { MapPreview } from '../../shared/map-preview/map-preview';
import { EventPinIcon } from '../../shared/event-filters/pin-icons';
import { EventsService } from '../../core/services/events.service';
import { AuthService } from '../../core/services/auth.service';
import { EventDetailDto } from '../../core/models/event.model';
import { OrganizerDetailDto, OrganizerType } from '../../core/models/organizer.model';
import {
  addressPrimary,
  addressSecondary,
  formatEventDate,
  formatPrice,
  formatTimeRange,
  googleMapsUrl,
  instagramHandle,
  instagramUrl,
  isLiveAt,
  minutesToStart,
  withoutCountry,
} from '../../core/utils/event-format';

/** Zoom level of the mini-map in the "Dove" card (Leaflet levels, like
 * /mappa's) street level, enough to read the surrounding streets without
 * being a full interactive map. */
const MINI_MAP_ZOOM = 16;

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
  imports: [AuthModal, SidebarPushDirective, NgIcon, NgTemplateOutlet, MapPreview, EventPinIcon],
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
  private readonly router = inject(Router);
  private readonly mapViewState = inject(MapViewStateService);
  private readonly eventsService = inject(EventsService);
  private readonly authService = inject(AuthService);

  protected readonly event = signal<EventDetailDto | null>(null);
  protected readonly loading = signal(true);

  /** Opens the shared login dialog when a signed-out visitor taps
   * Parteciperò/Mi piace both require a session server-side (same pattern
   * as map.ts). */
  protected readonly authOpen = signal(false);
  protected readonly going = signal(false);
  protected readonly liked = signal(false);
  /** No follow-organizer endpoint yet — local-only toggle. */
  protected readonly following = signal(false);

  /** Outline while not liked; filled with --ed-heart once liked shared by
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

  /** Where the "Dove" card's mini-map is centred (MapPreview, with this
   * event's pin drawn over it); null when the event has no coordinates (the
   * card then shows text only). Compared by value, so a count change on the
   * event doesn't hand the map a "new" centre. */
  protected readonly mapCenter = computed(
    () => {
      const event = this.event();
      return event?.latitude != null && event.longitude != null ? ([event.latitude, event.longitude] as [number, number]) : null;
    },
    { equal: (a, b) => a?.[0] === b?.[0] && a?.[1] === b?.[1] },
  );
  protected readonly miniMapZoom = MINI_MAP_ZOOM;

  protected readonly formatPrice = formatPrice;
  protected readonly formatDate = formatEventDate;
  protected readonly formatTimeRange = formatTimeRange;
  protected readonly addressPrimary = addressPrimary;
  protected readonly addressSecondary = addressSecondary;
  protected readonly googleMapsUrl = googleMapsUrl;
  protected readonly instagramUrl = instagramUrl;
  protected readonly instagramHandle = instagramHandle;
  protected readonly whatsappPath = WHATSAPP_PATH;

  /** Only the id, so the effect below doesn't refetch on every count change. */
  private readonly eventId = computed(() => this.event()?.id ?? null);
  private linkCopiedTimer: ReturnType<typeof setTimeout> | undefined;
  // Toggles with a request still in flight a second tap is ignored until
  // it settles, or add/remove could reach the server in the wrong order and
  // leave the button out of sync with the backend.
  private readonly pendingToggles = new Set<WritableSignal<boolean>>();

  // Ticks once a minute (browser only) so the live/soon badge moves on by
  // itself — "Inizia tra 5 min" → "LIVE ORA" — while the page stays open.
  // Purely local: startAt/endAt are already loaded, no backend calls.
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
    // template already renders as "not found" no separate error flag needed.
    if (!id) {
      this.loading.set(false);
      return;
    }

    this.eventsService.getEventDetail(id).subscribe({
      next: (event) => {
        this.event.set(event);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Opened from a shared link, to the map instead — see injectGoBack. */
  protected readonly goBack = injectGoBack('/mappa');

  // Opens /mappa centred on this event with its card already open the
  // map reads both from MapViewStateService when it mounts (see
  // restoreSelectedEvent in map.ts).
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

  // navigator.share on mobile browsers that support the native sheet;
  // falls back to copying the current URL to the clipboard.
  protected async share(event: EventDetailDto): Promise<void> {
    if (!this.isBrowser) return;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, url });
      } catch {
        // User dismissed the native share sheet nothing to do.
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

  // Shared by toggleGoing/toggleLike: flips local state immediately, fires
  // the matching add/remove request, and rolls back if it fails. Mirrors
  // EventEngagementService.toggleOptimistic, adapted to a single boolean instead of a Set.
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

  // Second line under the "Dove" heading: with a venue name as the first
  // line, the whole address; otherwise just what's left after the street.
  // Either way without the country, like the map's card (see withoutCountry).
  protected addressSubtitle(event: EventDetailDto): string | null {
    const address = withoutCountry(event.address);
    if (event.venueName) return address;
    return this.addressSecondary(address);
  }

  protected eventTypeLabel(event: EventDetailDto): string {
    return EVENT_TYPE_LABELS[event.eventType];
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
