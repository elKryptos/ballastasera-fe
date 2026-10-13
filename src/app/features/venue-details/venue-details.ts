import { Component, computed, effect, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideCheck,
  lucideCopy,
  lucideMaximize2,
  lucideNavigation,
  lucideShare2,
  lucideX,
} from '@ng-icons/lucide';
import { VENUE_PIN_COLORS, VENUE_PIN_GLYPHS, VENUE_TYPE_LABELS } from '../../core/config/map-pins';
import { injectGoBack } from '../../core/routing/go-back';
import { MapViewStateService } from '../../core/services/map-view-state.service';
import { PageSeo, SeoService, clip } from '../../core/services/seo.service';
import { VenuesService } from '../../core/services/venues.service';
import { VenueDetailDto } from '../../core/models/venue.model';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { MapPreview } from '../../shared/map-preview/map-preview';
import { VenuePinIcon } from '../../shared/event-filters/pin-icons';
import { addressPrimary, addressSecondary, googleMapsUrl, withoutCountry } from '../../core/utils/event-format';
import { injectPageShare } from '../../core/utils/page-share';
import { lockBodyScrollWhile } from '../../core/utils/scroll-lock';
import { CONTACT_ICONS, venueContacts } from '../../core/utils/contact-links';

/** Same street-level zoom as the event page's "Dove" mini-map. */
const MINI_MAP_ZOOM = 16;

/** Past this, "Chi siamo" starts folded to a few lines, with "Leggi tutto". */
const LONG_DESCRIPTION_CHARS = 220;

/** The actions' columns, by how many there are (directions plus up to six
 * contacts — the email isn't one of them): one each up to four, so a single
 * row fills the width; past that two rows, 3+2, 3+3 or 4+3. Spelled out for
 * Tailwind to find. */
const ACTION_COLUMNS = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-3', 'grid-cols-3', 'grid-cols-4'];

/**
 * A venue's page (school, club, bar...), opened from its card on /mappa —
 * "A · Profilo" from the Claude Design canvas "Pagina luogo – mobile": a
 * cover in the logo's colours, the logo overlapping it (tap to enlarge), the
 * name, the actions (directions and every contact, each once), then Dove and
 * Chi siamo. Colours: the --ev-* tokens in styles.css, shared with the event
 * page.
 */
@Component({
  selector: 'app-venue-details',
  templateUrl: './venue-details.html',
  imports: [SidebarPushDirective, NgIcon, NgTemplateOutlet, MapPreview, VenuePinIcon],
  host: {
    class: 'block min-h-dvh bg-ground text-(--ev-text)',
    // On the document, not the lightbox <div>: that div never holds focus, so a
    // keydown listener on it would never fire.
    '(document:keydown.escape)': 'closeLogo()',
  },
  providers: [
    provideIcons({
      ...CONTACT_ICONS,
      lucideArrowLeft,
      lucideCheck,
      lucideCopy,
      lucideMaximize2,
      lucideNavigation,
      lucideShare2,
      lucideX,
    }),
  ],
})
export class VenueDetails {
  private readonly venuesService = inject(VenuesService);
  private readonly mapViewState = inject(MapViewStateService);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  protected readonly venue = signal<VenueDetailDto | null>(null);
  protected readonly loading = signal(true);

  /** The logo's lightbox, opened by tapping the logo. */
  protected readonly logoOpen = signal(false);
  protected readonly descriptionExpanded = signal(false);
  /** Share (the native sheet, or copying the link) and copying the address;
   * copied() names the button that should say "Copiato" for a moment. */
  private readonly pageShare = injectPageShare<'address'>();
  protected readonly copied = this.pageShare.copied;

  /** Opened from a shared link, to the map instead — see injectGoBack. */
  protected readonly goBack = injectGoBack('/mappa');

  /** A tap on the mini-map: /mappa centred on this venue with its card open.
   * The map reads both from MapViewStateService (see takePageRequests). */
  protected openOnMap(venue: VenueDetailDto): void {
    if (venue.latitude == null || venue.longitude == null) return;
    this.mapViewState.center = [venue.latitude, venue.longitude];
    this.mapViewState.zoom = MINI_MAP_ZOOM;
    this.mapViewState.selectedEventId = null;
    this.mapViewState.openVenue = { id: venue.id, type: venue.type };
    void this.router.navigate(['/mappa']);
  }

  protected readonly typeLabels = VENUE_TYPE_LABELS;
  /** Same colour as the venue's badge on the map: the cover without a logo,
   * and the ring of the logo's marker on the mini-map. */
  protected readonly pinColors = VENUE_PIN_COLORS;
  /** The type's glyph, drawn large and faint on the cover without a logo. */
  protected readonly pinGlyphs = VENUE_PIN_GLYPHS;
  protected readonly miniMapZoom = MINI_MAP_ZOOM;

  /** Null when the venue has no coordinates: the "Dove" card then shows text only. */
  protected readonly mapCenter = computed(() => {
    const venue = this.venue();
    return venue?.latitude != null && venue.longitude != null ? ([venue.latitude, venue.longitude] as [number, number]) : null;
  });

  /** The "Dove" card: street, then "CAP city" (see addressSecondary), and directions. */
  protected readonly place = computed(() => {
    const venue = this.venue();
    if (!venue) return null;
    const address = withoutCountry(venue.address);
    return {
      street: addressPrimary(address),
      locality: addressSecondary(address),
      directionsUrl: googleMapsUrl(venue.address, venue.name),
    };
  });

  /** Only the contacts the venue has (see venueContacts). */
  private readonly contacts = computed(() => {
    const venue = this.venue();
    return venue ? venueContacts(venue) : [];
  });

  /** The actions under the name, after directions: every contact that goes
   * by its kind's name. */
  protected readonly actionContacts = computed(() => this.contacts().filter((contact) => !contact.spelledOut));

  /** The one that's spelled out instead — the email address — on a line of
   * its own under the actions: a tile has no room for it. */
  protected readonly writtenContacts = computed(() => this.contacts().filter((contact) => contact.spelledOut));

  /** Directions plus the contacts: icon over label with three or more, side
   * by side with fewer, where each button has the room. */
  protected readonly actionsLayout = computed(() => {
    const count = 1 + this.actionContacts().length;
    return { columns: ACTION_COLUMNS[count], stacked: count > 2 };
  });

  protected readonly longDescription = computed(
    () => (this.venue()?.description?.length ?? 0) > LONG_DESCRIPTION_CHARS,
  );

  constructor() {
    lockBodyScrollWhile(this.logoOpen);

    // The page's own title, description and canonical URL, once the venue is
    // in. Until then, and for a venue that isn't there, the home's stay.
    effect(() => {
      const venue = this.venue();
      if (venue) this.seo.set(venueSeo(venue), `/luogo/${venue.id}`);
    });

    const id = inject(ActivatedRoute).snapshot.paramMap.get('id');
    // No id or a failed fetch both end with venue() still null, which the
    // template renders as "not found".
    if (!id) {
      this.loading.set(false);
      return;
    }

    this.venuesService.getVenueDetail(id).subscribe({
      next: (venue) => {
        this.venue.set(venue);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openLogo(): void {
    this.logoOpen.set(true);
  }

  protected closeLogo(): void {
    this.logoOpen.set(false);
  }

  protected toggleDescription(): void {
    this.descriptionExpanded.update((expanded) => !expanded);
  }

  protected share(venue: VenueDetailDto): Promise<void> {
    return this.pageShare.share(venue.name);
  }

  protected copyAddress(venue: VenueDetailDto): Promise<void> {
    return this.pageShare.copy(withoutCountry(venue.address), 'address');
  }
}

/** "Piperita — Bar a Milano" and, under it in a search result, what and where
 * it is and the start of its own words. A school says what it teaches; OTHER
 * (halls, squares) has no name worth showing. */
function venueSeo(venue: VenueDetailDto): PageSeo {
  const kind = venue.type === 'SCHOOL' ? 'Scuola di ballo' : venue.type === 'OTHER' ? null : VENUE_TYPE_LABELS[venue.type];
  const where = kind ? `${kind} a ${venue.cityName}` : venue.cityName;
  const about = venue.description ?? 'Indirizzo, contatti e come arrivare.';
  return {
    title: `${venue.name} — ${where}`,
    description: clip(`${venue.name} — ${where}, ${addressPrimary(venue.address)}. ${about}`, 160),
  };
}
