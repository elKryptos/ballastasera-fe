import { Component, DestroyRef, PLATFORM_ID, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideCheck,
  lucideCircleCheck,
  lucideClock,
  lucideCopy,
  lucideGlobe,
  lucideHeart,
  lucideInstagram,
  lucideMaximize2,
  lucideNavigation,
  lucideShare2,
  lucideTag,
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
import { EventAttendeeDto, EventDetailDto } from '../../core/models/event.model';
import { OrganizerDetailDto } from '../../core/models/organizer.model';
import { eventIcs } from '../../core/utils/calendar';
import { nightDateLabel } from '../../core/utils/event-filters';
import {
  addressPrimary,
  addressSecondary,
  eventBadge,
  formatPrice,
  formatTimeRange,
  googleMapsUrl,
  instagramHandle,
  instagramUrl,
  withoutCountry,
} from '../../core/utils/event-format';

/** Zoom level of the mini-map in the "Dove" section (Leaflet levels, like
 * /mappa's): street level, enough to read the surrounding streets without
 * being a full interactive map. */
const MINI_MAP_ZOOM = 16;

/** Faces shown in "Chi ci va" before the "+N". */
const CROWD_FACES = 3;
/** Their colours when there's no photo: the canvas' sky, mint and yellow,
 * each with a dark initial on it. */
const FACE_TONES = [
  'bg-[#6aa8ff] text-[#0d1a33]',
  'bg-(--color-mint) text-[#0e2a26]',
  'bg-[#f5c04a] text-[#2a1d05]',
];

type ContactKind = 'instagram' | 'whatsapp' | 'website';

/** How long "Copiato" stays on the button that copied something. */
const COPIED_MS = 2000;

/** An event's page, from the "Scheda evento" artboard of the Claude Design
 * canvas: the flyer, who organizes it, when and how much, who's going, the
 * description and where, with Parteciperò and Mi piace always in reach. */
@Component({
  selector: 'app-event-details',
  templateUrl: './event-details.html',
  imports: [AuthModal, SidebarPushDirective, NgIcon, NgTemplateOutlet, MapPreview, EventPinIcon],
  host: {
    class: 'block min-h-dvh bg-(--color-ink) text-(--ev-text)',
    // On the document, not the lightbox <div>: that div never holds focus, so a
    // keydown listener on it would never fire.
    '(document:keydown.escape)': 'closeFlyer()',
  },
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideCheck,
      lucideCircleCheck,
      lucideClock,
      lucideCopy,
      lucideGlobe,
      lucideHeart,
      lucideInstagram,
      lucideMaximize2,
      lucideNavigation,
      lucideShare2,
      lucideTag,
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
  /** Who's going, by name — see loadAttendees(). Empty until it answers,
   * or if it can't: "Chi ci va" then goes by goingCount alone. */
  private readonly attendees = signal<EventAttendeeDto[]>([]);

  /** Opens the shared login dialog when a signed-out visitor taps
   * Parteciperò/Mi piace: both require a session server-side (same pattern
   * as map.ts). */
  protected readonly authOpen = signal(false);
  protected readonly going = signal(false);
  protected readonly liked = signal(false);
  /** No follow-organizer endpoint yet — local-only toggle. */
  protected readonly following = signal(false);

  /** lucideHeart's <svg> hardcodes fill="none" and ng-icon has no input for
   * it, so a liked heart is filled through an arbitrary variant on the inner
   * svg. Its colour follows the button's. */
  protected readonly heartIconClass = computed(() => (this.liked() ? '[&_svg]:fill-current' : ''));
  /** The button that just copied something shows "Copiato" for a moment:
   * the share fallback (the page's link) or "Copia indirizzo". */
  protected readonly copied = signal<'link' | 'address' | null>(null);

  /** Fullscreen flyer lightbox: tap the hero to open, tap the image again to
   * toggle between fit-to-screen and full-size (pannable via scroll). */
  protected readonly flyerOpen = signal(false);
  protected readonly flyerZoomed = signal(false);

  /** Where the "Dove" mini-map is centred (MapPreview, with this event's pin
   * drawn over it); null when the event has no coordinates (the section then
   * shows text only). Compared by value, so a count change on the event
   * doesn't hand the map a "new" centre. */
  protected readonly mapCenter = computed(
    () => {
      const event = this.event();
      return event?.latitude != null && event.longitude != null ? ([event.latitude, event.longitude] as [number, number]) : null;
    },
    { equal: (a, b) => a?.[0] === b?.[0] && a?.[1] === b?.[1] },
  );
  protected readonly miniMapZoom = MINI_MAP_ZOOM;

  // Ticks once a minute (browser only) so the badge and the date move on by
  // themselves ("Inizia tra 5 min" → "Live · finisce tra…") while the page
  // stays open. Purely local: startAt/endAt are already loaded.
  private readonly now = signal(Date.now());

  /** On the flyer (or, without one, next to the eyebrow): "Live · finisce
   * tra 52 min" or "Inizia tra 12 min"; nothing otherwise. */
  protected readonly status = computed(() => {
    const event = this.event();
    return event ? eventBadge(event, this.now()) : null;
  });

  /** "Stasera, gio 1 ott", "Domani, …" or "Sabato 3 ottobre". */
  protected readonly dateLabel = computed(() => {
    const event = this.event();
    return event ? nightDateLabel(event, this.now()) : '';
  });

  /** The event's own links (set when it was created, from its venue or its
   * organizer), the organizer's Instagram where the event has none, and
   * the organizer's website. */
  protected readonly contacts = computed(() => {
    const event = this.event();
    if (!event) return [];
    const contacts: { kind: ContactKind; href: string; label: string }[] = [];
    const instagram = event.instagramUrl || event.organizer?.instagram;
    if (instagram) contacts.push({ kind: 'instagram', href: instagramUrl(instagram), label: `@${instagramHandle(instagram)}` });
    if (event.whatsappUrl) contacts.push({ kind: 'whatsapp', href: event.whatsappUrl, label: 'WhatsApp' });
    if (event.organizer?.website) contacts.push({ kind: 'website', href: event.organizer.website, label: 'Sito web' });
    return contacts;
  });

  /** "Chi ci va": a few faces of the people going and a "+N" for the rest,
   * then who they are in words ("Sara e Luca e altri 10"). goingCount is the
   * total — it already counts a tap on Parteciperò — while the names, first
   * names only, come from the attendees, when there are any. */
  protected readonly crowd = computed(() => {
    const event = this.event();
    if (!event) return null;
    const people = this.attendees();
    const total = Math.max(event.goingCount, people.length);
    const faces = people.slice(0, CROWD_FACES).map((person, i) => ({
      ...person,
      initial: person.displayName.trim().charAt(0).toUpperCase(),
      tone: FACE_TONES[i % FACE_TONES.length],
    }));
    const names = people.slice(0, 2).map((person) => person.displayName.trim().split(/\s+/)[0]);
    return {
      total,
      faces,
      more: total - faces.length,
      names: names.join(' e '),
      others: total - names.length,
    };
  });

  protected readonly formatPrice = formatPrice;
  protected readonly formatTimeRange = formatTimeRange;
  protected readonly addressPrimary = addressPrimary;
  protected readonly googleMapsUrl = googleMapsUrl;
  protected readonly whatsappPath = WHATSAPP_PATH;

  /** Only the id, so the effect below doesn't refetch on every count change. */
  private readonly eventId = computed(() => this.event()?.id ?? null);
  private copiedTimer: ReturnType<typeof setTimeout> | undefined;
  // Toggles with a request still in flight: a second tap is ignored until
  // it settles, or add/remove could reach the server in the wrong order and
  // leave the button out of sync with the backend.
  private readonly pendingToggles = new Set<WritableSignal<boolean>>();

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
      clearTimeout(this.copiedTimer);
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
    // template already renders as "not found": no separate error flag needed.
    if (!id) {
      this.loading.set(false);
      return;
    }

    this.eventsService.getEventDetail(id).subscribe({
      next: (event) => {
        this.event.set(event);
        this.loading.set(false);
        this.loadAttendees(event.id);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Opened from a shared link, to the map instead — see injectGoBack. */
  protected readonly goBack = injectGoBack('/mappa');

  // Opens /mappa centred on this event with its card already open: the
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
      // The visitor joins (or leaves) "Chi ci va" by name too.
      () => this.loadAttendees(event.id),
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
        // User dismissed the native share sheet: nothing to do.
      }
      return;
    }
    await this.copy(url, 'link');
  }

  protected copyAddress(event: EventDetailDto): Promise<void> {
    return this.copy(withoutCountry(event.address), 'address');
  }

  /** "+ Calendario": hands the browser an .ics file (see eventIcs). */
  protected addToCalendar(event: EventDetailDto): void {
    if (!this.isBrowser) return;
    const file = new Blob([eventIcs(event, window.location.href)], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = `${event.slug || 'serata'}.ics`;
    link.click();
    // Later rather than right away: some browsers start the download after
    // click() returns.
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
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

  /** The first few people going (EventsService.getAttendees), asked only
   * here — the map's and the list's cards just show the count. Browser only:
   * it's not worth a request during server rendering. */
  private loadAttendees(id: string): void {
    if (!this.isBrowser) return;
    this.eventsService.getAttendees(id, CROWD_FACES).subscribe({
      next: (page) => this.attendees.set(page.content),
      error: () => this.attendees.set([]),
    });
  }

  private async copy(text: string, what: 'link' | 'address'): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // No clipboard API (insecure context) or permission denied: nothing to show.
      return;
    }
    this.copied.set(what);
    clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => this.copied.set(null), COPIED_MS);
  }

  // Shared by toggleGoing/toggleLike: flips local state immediately, fires
  // the matching add/remove request, and rolls back if it fails. Mirrors
  // EventEngagementService.toggleOptimistic, adapted to a single boolean
  // instead of a Set.
  private toggleOptimistic(
    stateSignal: WritableSignal<boolean>,
    id: string,
    add: (id: string) => Observable<void>,
    remove: (id: string) => Observable<void>,
    adjustCount: (activating: boolean) => void,
    saved?: () => void,
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
      complete: () => {
        this.pendingToggles.delete(stateSignal);
        saved?.();
      },
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

  // Second line under the place's name: with a venue name as the first
  // line, the whole address; otherwise just what's left after the street.
  // Either way without the country, like the map's card (see withoutCountry).
  protected addressSubtitle(event: EventDetailDto): string | null {
    const address = withoutCountry(event.address);
    return event.venueName ? address : addressSecondary(address);
  }

  protected eventTypeLabel(event: EventDetailDto): string {
    return EVENT_TYPE_LABELS[event.eventType];
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
