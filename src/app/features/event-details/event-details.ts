import { Component, DestroyRef, PLATFORM_ID, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT, NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideCheck,
  lucideCircleCheck,
  lucideClock,
  lucideCopy,
  lucideHeart,
  lucideMaximize2,
  lucideNavigation,
  lucideShare2,
  lucideTag,
  lucideUsers,
  lucideX,
} from '@ng-icons/lucide';
import { EVENT_TYPE_LABELS, VENUE_TYPE_LABELS } from '../../core/config/map-pins';
import { injectGoBack } from '../../core/routing/go-back';
import { MapViewStateService } from '../../core/services/map-view-state.service';
import { AuthModal } from '../../shared/auth-modal/auth-modal';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { LinkedText } from '../../shared/linked-text/linked-text';
import { MapPreview } from '../../shared/map-preview/map-preview';
import { EventPinIcon, VenuePinIcon } from '../../shared/event-filters/pin-icons';
import { EventsService } from '../../core/services/events.service';
import { AuthService } from '../../core/services/auth.service';
import { PageSeo, SeoService, clip } from '../../core/services/seo.service';
import { EventAttendeeDto, EventDetailDto } from '../../core/models/event.model';
import { OrganizerDetailDto } from '../../core/models/organizer.model';
import { eventIcs } from '../../core/utils/calendar';
import { injectPageShare } from '../../core/utils/page-share';
import { lockBodyScrollWhile } from '../../core/utils/scroll-lock';
import { nightDateLabel, nightLongDate } from '../../core/utils/event-filters';
import {
  addressPrimary,
  addressSecondary,
  eventBadge,
  formatClock,
  formatPrice,
  googleMapsUrl,
  instagramUrl,
  withoutCountry,
} from '../../core/utils/event-format';
import {
  CONTACT_ICONS,
  ContactLink,
  contactLink,
  sameContact,
  venueContacts,
  withWhatsappText,
} from '../../core/utils/contact-links';

/** Zoom level of the mini-map in the "Dove" section (Leaflet levels, like
 * /mappa's): street level, enough to read the surrounding streets without
 * being a full interactive map. */
const MINI_MAP_ZOOM = 16;

/** Past this — or with more lines of its own than the three it folds to —
 * the venue's description in its card starts folded, with "Leggi tutto". */
const LONG_VENUE_ABOUT_CHARS = 140;

/** Faces shown in "Chi ci va" before the "+N". */
const CROWD_FACES = 3;
/** Their colours when there's no photo: the canvas' sky, mint and yellow,
 * each with a dark initial on it. */
const FACE_TONES = [
  'bg-[#6aa8ff] text-[#0d1a33]',
  'bg-(--color-mint) text-[#0e2a26]',
  'bg-[#f5c04a] text-[#2a1d05]',
];

/** An event's page, from the "Scheda evento" artboard of the Claude Design
 * canvas: the flyer, where it's held, when and how much, who's going, the
 * description, who organizes it and the way there, with Parteciperò and Mi
 * piace always in reach. */
@Component({
  selector: 'app-event-details',
  templateUrl: './event-details.html',
  imports: [AuthModal, SidebarPushDirective, NgIcon, NgTemplateOutlet, MapPreview, EventPinIcon, VenuePinIcon, LinkedText],
  host: {
    class: 'block min-h-dvh bg-ground text-(--ev-text)',
    // On the document, not the lightbox <div>: that div never holds focus, so a
    // keydown listener on it would never fire.
    '(document:keydown.escape)': 'closeFlyer()',
  },
  providers: [
    provideIcons({
      ...CONTACT_ICONS,
      lucideArrowLeft,
      lucideCheck,
      lucideCircleCheck,
      lucideClock,
      lucideCopy,
      lucideHeart,
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
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly mapViewState = inject(MapViewStateService);
  private readonly eventsService = inject(EventsService);
  private readonly authService = inject(AuthService);
  private readonly seo = inject(SeoService);

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

  /** lucideHeart's <svg> hardcodes fill="none" and ng-icon has no input for
   * it, so a liked heart is filled through an arbitrary variant on the inner
   * svg. Its colour follows the button's. */
  protected readonly heartIconClass = computed(() => (this.liked() ? '[&_svg]:fill-current' : ''));
  /** Share (the native sheet, or copying the link) and "Copia indirizzo";
   * copied() names the button that should say "Copiato" for a moment. */
  private readonly pageShare = injectPageShare<'address'>();
  protected readonly copied = this.pageShare.copied;

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

  /** "Dove" in words — the event's own address, without the country (see
   * withoutCountry): the street and, on a line of its own, what's left of
   * the address after it — and the way there. */
  protected readonly place = computed(() => {
    const event = this.event();
    if (!event) return null;
    const address = withoutCountry(event.address);
    return {
      street: addressPrimary(address),
      locality: addressSecondary(address),
      directionsUrl: googleMapsUrl(event.address, event.venue?.name ?? null),
    };
  });

  /** The venue's own address, in one line for its card. Everything on that
   * card is the venue's: the event's address, which may differ, is "Dove"'s. */
  protected readonly venueAddress = computed(() => {
    const venue = this.event()?.venue;
    if (!venue) return '';
    const address = withoutCountry(venue.address);
    return [addressPrimary(address), addressSecondary(address)].filter(Boolean).join(', ');
  });

  protected readonly venueTypeLabels = VENUE_TYPE_LABELS;
  protected readonly venueAboutExpanded = signal(false);
  protected readonly longVenueAbout = computed(() => {
    const about = this.event()?.venue?.description ?? '';
    return about.length > LONG_VENUE_ABOUT_CHARS || about.split('\n').length > 3;
  });

  // Ticks once a minute (browser only) so the badge and the date move on by
  // themselves ("Inizia tra 5 min" → "Live · dalle 22:30") while the page
  // stays open. Purely local: startAt/endAt are already loaded.
  private readonly now = signal(Date.now());

  /** On the flyer (or, without one, next to the eyebrow): "Live · dalle
   * 22:30" or "Inizia tra 12 min"; nothing otherwise. */
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
   * the organizer's website — less whatever the venue's card already links
   * to: an event's links are often its venue's, copied over when it was
   * created, and each is shown once. */
  protected readonly contacts = computed(() => {
    const event = this.event();
    if (!event) return [];
    const contacts: ContactLink[] = [];
    const instagram = event.instagramUrl || event.organizer?.instagram;
    if (instagram) contacts.push(contactLink('instagram', instagramUrl(instagram)));
    if (event.whatsappUrl) contacts.push(contactLink('whatsapp', event.whatsappUrl));
    if (event.organizer?.website) contacts.push(contactLink('website', event.organizer.website));
    const atVenue = this.venueOwnLinks();
    const own = contacts.filter((contact) => !atVenue.some((link) => sameContact(link, contact)));
    return withWhatsappText(own, this.whatsappText());
  });

  /** The venue's own contacts, every one it has, as they are. */
  private readonly venueOwnLinks = computed(() => {
    const venue = this.event()?.venue;
    return venue ? venueContacts(venue) : [];
  });

  /** The same, for the venue's card. */
  protected readonly venueLinks = computed(() => withWhatsappText(this.venueOwnLinks(), this.whatsappText()));

  /** What a tap on WhatsApp starts the chat with, on the venue's card and
   * the organizer's alike: where the visitor comes from, which night they
   * mean — by name, date and link, since whoever answers may run several —
   * and what they're after. In Italian, like the people it's sent to. */
  private readonly whatsappText = computed(() => {
    const event = this.event();
    if (!event) return '';
    const page = `${this.document.location.origin}/evento/${event.id}`;
    return (
      `Ciao! Ti scrivo da ballastasera.it: vorrei qualche informazione su "${event.title}" ` +
      `di ${nightLongDate(event)} e su come funziona la prenotazione.\n${page}`
    );
  });

  /** "Chi ci va": a few faces of the people going and a "+N" for the rest,
   * then who they are in words ("Sara e Luca e altri 10"). goingCount is the
   * total — it already counts a tap on Parteciperò — while the names, first
   * names only, come from the attendees, when there are any. Null while
   * nobody's going: the section isn't shown, rather than saying so on every
   * new night. */
  protected readonly crowd = computed(() => {
    const event = this.event();
    if (!event) return null;
    const people = this.attendees();
    const total = Math.max(event.goingCount, people.length);
    if (total === 0) return null;
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
  protected readonly formatClock = formatClock;

  /** Only the id, so the effect below doesn't refetch on every count change. */
  private readonly eventId = computed(() => this.event()?.id ?? null);
  // Toggles with a request still in flight: a second tap is ignored until
  // it settles, or add/remove could reach the server in the wrong order and
  // leave the button out of sync with the backend.
  private readonly pendingToggles = new Set<WritableSignal<boolean>>();

  constructor() {
    const destroyRef = inject(DestroyRef);

    lockBodyScrollWhile(this.flyerOpen);
    const clock = this.isBrowser ? setInterval(() => this.now.set(Date.now()), 60_000) : undefined;
    destroyRef.onDestroy(() => clearInterval(clock));

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

    // The page's own title, description and canonical URL, once the event is
    // in. Until then, and for an event that isn't there, the home's stay.
    effect(() => {
      const event = this.event();
      if (event) this.seo.set(eventSeo(event), `/evento/${event.id}`);
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

  protected toggleVenueAbout(): void {
    this.venueAboutExpanded.update((expanded) => !expanded);
  }

  protected share(event: EventDetailDto): Promise<void> {
    return this.pageShare.share(event.title);
  }

  protected copyAddress(event: EventDetailDto): Promise<void> {
    return this.pageShare.copy(withoutCountry(event.address), 'address');
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

/** "Serata Caraibica — Piperita, martedì 13 ottobre" and, under it in a search
 * result, the night, the place, what's danced and the price. No start time:
 * the server would write it in its own timezone, not Italy's. */
function eventSeo(event: EventDetailDto): PageSeo {
  const date = nightLongDate(event);
  const where = [event.venue?.name, addressPrimary(event.address), event.cityName].filter(Boolean).join(', ');
  return {
    title: `${event.title} — ${event.venue?.name ?? event.cityName}, ${date}`,
    description: clip(
      [`${event.title}, ${date}`, where, event.danceStyles.join(', '), formatPrice(event)].filter(Boolean).join(' · '),
      160,
    ),
  };
}
