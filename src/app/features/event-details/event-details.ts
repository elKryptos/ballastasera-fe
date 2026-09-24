import { Component, PLATFORM_ID, WritableSignal, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
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
  lucideShare2,
  lucideTicket,
  lucideUserCheck,
  lucideUserPlus,
  lucideUsers,
  lucideX,
} from '@ng-icons/lucide';
import { Navbar } from '../../shared/navbar/navbar';
import { AuthModal } from '../../shared/auth-modal/auth-modal';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { EventsService } from '../../core/services/events.service';
import { AuthService } from '../../core/services/auth.service';
import { EventDetailDto, EventType } from '../../core/models/event.model';
import { OrganizerDetailDto, OrganizerType } from '../../core/models/organizer.model';

/** Same window used by the map's popup card — see STARTING_SOON_MS in map.ts. */
const STARTING_SOON_MS = 30 * 60 * 1000;

/** A civico is 1-4 digits with an optional letter/slash suffix (e.g. "12",
 * "12/A"); a 5-digit Italian CAP never matches, so it's left for addressSecondary. */
function isCivico(part: string): boolean {
  return /^\d{1,4}(\/?[a-zA-Z0-9]{0,3})?$/.test(part);
}

/** Italian label per EventType, same wording as the map's legend (PIN_LABELS in map.ts). */
const EVENT_TYPE_LABELS: Record<EventType, string> = {
  EVENT: 'Evento',
  SCHOOL: 'Scuola',
  CLUB: 'Discoteca',
  BAR: 'Bar',
};

/** Same per-type colours as the map's pins (PIN_COLORS in map.ts) — drives the
 * animated aurora backdrop below so an event's page opens already tinted the
 * way its pin read on the map. */
const EVENT_TYPE_COLORS: Record<EventType, string> = {
  EVENT: '#ff4d6d', // rose
  SCHOOL: '#8b5cf6', // violet
  CLUB: '#2dd4bf', // mint
  BAR: '#ffa24c', // amber
};

const ORGANIZER_TYPE_LABELS: Record<OrganizerType, string> = {
  PERSON: 'Organizzatore',
  VENUE: 'Locale',
  CLUB: 'Discoteca',
  SCHOOL: 'Scuola',
  ASSOCIATION: 'Associazione',
};

type PillColor = 'violet' | 'mint' | 'rose';

// Tailwind's JIT scanner needs every class name to appear literally
// somewhere in source — a template-string build like `border-${color}`
// would silently never be generated, hence this lookup table instead of
// interpolating pillClass()'s color argument directly.
const PILL_ACTIVE: Record<PillColor, string> = {
  violet: 'border-violet bg-violet text-white',
  mint: 'border-mint bg-mint text-white',
  rose: 'border-rose bg-rose text-white',
};
// Same tint+white-text language as the map popup's own action buttons
// (see map.html) — border color stays default (--border/line), only bg+text
// flip, so the two cards' buttons read as one shared component.
const PILL_INACTIVE: Record<PillColor, string> = {
  violet: 'bg-violet/15 text-white',
  mint: 'bg-mint/15 text-white',
  rose: 'bg-rose/15 text-white',
};

@Component({
  selector: 'app-event-details',
  templateUrl: './event-details.html',
  styleUrl: './event-details.css',
  imports: [Navbar, AuthModal, SidebarPushDirective, NgIcon],
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
      lucideShare2,
      lucideTicket,
      lucideUserCheck,
      lucideUserPlus,
      lucideUsers,
      lucideX,
    }),
  ],
})
export class EventDetails {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly eventsService = inject(EventsService);
  private readonly authService = inject(AuthService);

  protected readonly event = signal<EventDetailDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  /** Opens the shared login dialog when a signed-out visitor taps
   * Parteciperò/Mi piace — both require a session server-side (same pattern
   * as map.ts). */
  protected readonly authOpen = signal(false);
  protected readonly going = signal(false);
  protected readonly liked = signal(false);
  /** No follow-organizer endpoint yet — local-only toggle, same as map.ts. */
  protected readonly following = signal(false);
  /** Briefly swaps the share icon for a checkmark after copying the link
   * (clipboard fallback for browsers without navigator.share). */
  protected readonly linkCopied = signal(false);

  /** Fullscreen flyer lightbox: tap the hero to open, tap the image again to
   * toggle between fit-to-screen and full-size (pannable via scroll). */
  protected readonly flyerOpen = signal(false);
  protected readonly flyerZoomed = signal(false);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.error.set(true);
      return;
    }

    this.eventsService.getEventDetail(id).subscribe({
      next: (event) => {
        this.event.set(event);
        this.loading.set(false);
        this.syncToggleState(event.id);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });

    // Same body-scroll lock as auth-modal.ts, DOM-only hence the platform check.
    effect(() => {
      if (!this.isBrowser) return;
      document.body.style.overflow = this.flyerOpen() ? 'hidden' : '';
    });
  }

  private syncToggleState(eventId: string): void {
    if (!this.authService.isAuthenticated()) return;

    this.eventsService.isGoing(eventId).subscribe({ next: (active) => this.going.set(active) });
    this.eventsService.isFavorite(eventId).subscribe({ next: (active) => this.liked.set(active) });
  }

  protected goBack(): void {
    this.location.back();
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

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    }
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
   * toggleOptimistic in map.ts, adapted to a single boolean instead of a Set. */
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

    const wasActive = stateSignal();
    stateSignal.set(!wasActive);
    adjustCount(!wasActive);

    const request = wasActive ? remove(id) : add(id);
    request.subscribe({
      error: () => {
        stateSignal.set(wasActive);
        adjustCount(wasActive);
      },
    });
  }

  private adjustCount(field: 'likesCount' | 'goingCount', delta: number): void {
    this.event.update((event) => (event ? { ...event, [field]: Math.max(0, event[field] + delta) } : event));
  }

  protected isLiveNow(event: EventDetailDto): boolean {
    const now = Date.now();
    return now >= new Date(event.startAt).getTime() && now <= new Date(event.endAt).getTime();
  }

  protected startsInMinutes(event: EventDetailDto): number | null {
    const msToStart = new Date(event.startAt).getTime() - Date.now();
    if (msToStart <= 0 || msToStart > STARTING_SOON_MS) return null;
    return Math.max(1, Math.round(msToStart / 60000));
  }

  /** Numeric day/month/year (e.g. "21/09/2026") — kept as its own method,
   * separate from formatTimeRange below, since the Quando quick fact
   * renders the date and the start-end time on their own lines. */
  protected formatDate(event: EventDetailDto): string {
    return new Date(event.startAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
    const time = new Date(iso).toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${time}h`;
  }

  protected formatPrice(event: EventDetailDto): string {
    if (event.isFree) return 'GRATIS';
    if (event.price == null) return 'Prezzo su invito';
    return `${event.price} ${event.currency ?? ''}`.trim();
  }

  /** Geocoded addresses already join street+civico with a space ("Via Roma
   * 12"), but older/manually-typed ones use a comma ("Via Roma, 12") — this
   * merges a leading civico into the primary line either way, while a 5-digit
   * CAP in the same position is left for addressSecondary. */
  protected addressPrimary(address: string): string {
    const parts = address.split(',').map((p) => p.trim());
    return parts.length > 1 && isCivico(parts[1]) ? `${parts[0]} ${parts[1]}` : parts[0];
  }

  protected addressSecondary(address: string): string | null {
    const parts = address.split(',').map((p) => p.trim());
    if (parts.length <= 1) return null;
    const rest = isCivico(parts[1]) ? parts.slice(2) : parts.slice(1);
    return rest.length ? rest.join(', ') : null;
  }

  protected googleMapsUrl(event: EventDetailDto): string {
    const query = event.venueName ? `${event.venueName}, ${event.address}` : event.address;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
  }

  protected instagramUrl(handle: string): string {
    return `https://www.instagram.com/${handle}/`;
  }

  /** Shared by the Parteciperò/Mi piace/Segui pills: same active-vs-idle
   * border+bg+text combination, just a different accent colour per button. */
  protected pillClass(active: boolean, color: PillColor): string {
    return active ? PILL_ACTIVE[color] : PILL_INACTIVE[color];
  }

  protected goingCountIconClass(goingCount: number): string {
    return goingCount > 0 ? 'text-violet' : 'text-bone/85';
  }

  protected eventTypeLabel(event: EventDetailDto): string {
    return EVENT_TYPE_LABELS[event.eventType];
  }

  protected eventTypeColor(event: EventDetailDto): string {
    return EVENT_TYPE_COLORS[event.eventType];
  }

  /** With a flyer, the hero's own sticky @[768px]:h-dvh forces this column
   * tall via flex stretch — but with no flyer there's no hero at all (see
   * event-details.html), so nothing makes the column reach the bottom of
   * the viewport and its aurora/starfield backdrop stops short, leaving a
   * plain unstyled gap below the content. Forcing a floor here — viewport
   * minus the fixed mobile header below md, full viewport from md up where
   * the header becomes the sidebar instead (mirrors main's own
   * pt-(--header-h) md:pt-0) — closes that gap. */
  protected bodyColumnClass(event: EventDetailDto): string {
    const base = 'relative overflow-hidden bg-ink @[768px]:min-w-0 @[768px]:flex-1';
    return event.flyerUrl ? base : `${base} min-h-[calc(100dvh-var(--header-h))] md:min-h-dvh`;
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
