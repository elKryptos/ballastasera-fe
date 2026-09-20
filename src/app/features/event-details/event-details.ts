import { Component, PLATFORM_ID, WritableSignal, inject, signal } from '@angular/core';
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

/** Italian label per EventType, same wording as the map's legend (PIN_LABELS in map.ts). */
const EVENT_TYPE_LABELS: Record<EventType, string> = {
  EVENT: 'Evento',
  SCHOOL: 'Scuola',
  CLUB: 'Discoteca',
  BAR: 'Bar',
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
const PILL_INACTIVE: Record<PillColor, string> = {
  violet: 'border-violet/25 bg-violet/10 text-violet',
  mint: 'border-mint/25 bg-mint/10 text-mint',
  rose: 'border-rose/25 bg-rose/10 text-rose',
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

  protected formatStart(event: EventDetailDto): string {
    return new Date(event.startAt).toLocaleString('it-IT', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected formatPrice(event: EventDetailDto): string {
    if (event.free) return 'GRATIS';
    if (event.price == null) return 'Prezzo su invito';
    return `${event.price} ${event.currency ?? ''}`.trim();
  }

  protected addressPrimary(address: string): string {
    const idx = address.indexOf(',');
    return idx === -1 ? address : address.slice(0, idx).trim();
  }

  protected addressSecondary(address: string): string | null {
    const idx = address.indexOf(',');
    return idx === -1 ? null : address.slice(idx + 1).trim();
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
    return goingCount > 0 ? 'text-violet' : 'text-ink/40';
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
