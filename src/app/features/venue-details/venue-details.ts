import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideCheck,
  lucideCopy,
  lucideFacebook,
  lucideGlobe,
  lucideInstagram,
  lucideMail,
  lucideMaximize2,
  lucideNavigation,
  lucideShare2,
  lucideX,
  lucideYoutube,
} from '@ng-icons/lucide';
import { TIKTOK_PATH, WHATSAPP_PATH } from '../../core/config/brand-icons';
import { VENUE_PIN_COLORS, VENUE_PIN_GLYPHS, VENUE_TYPE_LABELS } from '../../core/config/map-pins';
import { injectGoBack } from '../../core/routing/go-back';
import { MapViewStateService } from '../../core/services/map-view-state.service';
import { VenuesService } from '../../core/services/venues.service';
import { VenueDetailDto } from '../../core/models/venue.model';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { MapPreview } from '../../shared/map-preview/map-preview';
import { VenuePinIcon } from '../../shared/event-filters/pin-icons';
import {
  addressPrimary,
  addressSecondary,
  googleMapsUrl,
  instagramHandle,
  instagramUrl,
  waMeUrl,
  withoutCountry,
} from '../../core/utils/event-format';
import { injectPageShare } from '../../core/utils/page-share';
import { lockBodyScrollWhile } from '../../core/utils/scroll-lock';

/** Same street-level zoom as the event page's "Dove" mini-map. */
const MINI_MAP_ZOOM = 16;

/** Past this, "Chi siamo" starts folded to a few lines, with "Leggi tutto". */
const LONG_DESCRIPTION_CHARS = 220;

type ContactKey = 'whatsapp' | 'instagram' | 'website' | 'email' | 'facebook' | 'tiktok' | 'youtube';

/** How each contact the venue may have shows in the "Contatti" card. The tile
 * behind the icon takes the brand's own colour where it has one, so each
 * link reads at a glance. Logos lucide lacks are drawn from svgPath. */
interface ContactKind {
  key: ContactKey;
  tileClass: string;
  icon?: string;
  svgPath?: string;
  /** Defaults to the value itself (the URL the admin entered); Instagram
   * holds just the handle. */
  href?: (value: string) => string;
  label: (value: string) => string;
  /** mailto: stays in this tab — a new one would just open blank. */
  sameTab?: boolean;
  /** Set on the most direct ones, which also get a quick action under the
   * name: its label there. */
  quickLabel?: string;
}

/** In display order: most direct first. */
const CONTACT_KINDS: ContactKind[] = [
  {
    key: 'whatsapp',
    tileClass: 'bg-[#25D366] text-white',
    svgPath: WHATSAPP_PATH,
    href: (phone) => waMeUrl(phone) ?? '',
    label: (phone) => phone,
    quickLabel: 'WhatsApp',
  },
  {
    key: 'instagram',
    tileClass: 'instagram-gradient text-white',
    icon: 'lucideInstagram',
    href: instagramUrl,
    label: (handle) => `@${instagramHandle(handle)}`,
    quickLabel: 'Instagram',
  },
  {
    key: 'website',
    tileClass: 'bg-(--ev-tag-bg) text-(--ev-tag-text)',
    icon: 'lucideGlobe',
    label: hostname,
    quickLabel: 'Sito',
  },
  {
    key: 'email',
    tileClass: 'bg-(--ev-tag-bg) text-(--ev-tag-text)',
    icon: 'lucideMail',
    href: (email) => `mailto:${email}`,
    label: (email) => email,
    sameTab: true,
  },
  { key: 'facebook', tileClass: 'bg-[#1877F2] text-white', icon: 'lucideFacebook', label: () => 'Facebook' },
  { key: 'tiktok', tileClass: 'bg-black text-white', svgPath: TIKTOK_PATH, label: () => 'TikTok' },
  { key: 'youtube', tileClass: 'bg-[#FF0000] text-white', icon: 'lucideYoutube', label: () => 'YouTube' },
];

/** One column per quick action, so the row always fills the width. Spelled out
 * for Tailwind to find. */
const ACTION_COLUMNS = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4'];

/** "https://www.scuola.it/contatti" → "scuola.it". */
function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Sito web';
  }
}

/**
 * A venue's page (school, club, bar...), opened from its card on /mappa —
 * "A · Profilo" from the Claude Design canvas "Pagina luogo – mobile": a
 * cover in the logo's colours, the logo overlapping it (tap to enlarge), the
 * name, a row of quick actions, then Dove, Chi siamo and Contatti. Colours:
 * the --ev-* tokens in styles.css, shared with the event page.
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
      lucideArrowLeft,
      lucideCheck,
      lucideCopy,
      lucideFacebook,
      lucideGlobe,
      lucideInstagram,
      lucideMail,
      lucideMaximize2,
      lucideNavigation,
      lucideShare2,
      lucideX,
      lucideYoutube,
    }),
  ],
})
export class VenueDetails {
  private readonly venuesService = inject(VenuesService);
  private readonly mapViewState = inject(MapViewStateService);
  private readonly router = inject(Router);

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

  /** Only the contacts the venue has. */
  protected readonly contacts = computed(() => {
    const venue = this.venue();
    if (!venue) return [];
    return CONTACT_KINDS.flatMap((kind) => {
      const value = venue[kind.key];
      if (!value) return [];
      return [{ ...kind, href: kind.href?.(value) ?? value, label: kind.label(value) }];
    });
  });

  /** The quick actions under the name, after directions: the venue's most
   * direct contacts (quickLabel), when it has them. */
  protected readonly quickContacts = computed(() => this.contacts().filter((contact) => contact.quickLabel));

  /** Directions plus the quick contacts: icon over label with three or
   * more, side by side with fewer, where each button has the room. */
  protected readonly actionsLayout = computed(() => {
    const count = 1 + this.quickContacts().length;
    return { columns: ACTION_COLUMNS[count], stacked: count > 2 };
  });

  protected readonly longDescription = computed(
    () => (this.venue()?.description?.length ?? 0) > LONG_DESCRIPTION_CHARS,
  );

  constructor() {
    lockBodyScrollWhile(this.logoOpen);

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
