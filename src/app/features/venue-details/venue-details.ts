import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideFacebook, lucideGlobe, lucideInstagram, lucideMail, lucideYoutube } from '@ng-icons/lucide';
import { TIKTOK_PATH, WHATSAPP_PATH } from '../../core/config/brand-icons';
import { VENUE_PIN_COLORS, VENUE_TYPE_LABELS } from '../../core/config/map-pins';
import { injectGoBack } from '../../core/routing/go-back';
import { VenuesService } from '../../core/services/venues.service';
import { VenueDetailDto } from '../../core/models/venue.model';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { MapPreview } from '../../shared/map-preview/map-preview';
import { VenuePinIcon } from '../../shared/event-filters/pin-icons';
import { addressPrimary, addressSecondary, googleMapsUrl, instagramUrl, waMeUrl, withoutCountry } from '../../core/utils/event-format';

/** Same street-level zoom as the event page's "Dove" mini-map. */
const MINI_MAP_ZOOM = 16;

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
}

/** In display order: most direct first. */
const CONTACT_KINDS: ContactKind[] = [
  {
    key: 'whatsapp',
    tileClass: 'bg-[#25D366] text-white',
    svgPath: WHATSAPP_PATH,
    href: (phone) => waMeUrl(phone) ?? '',
    label: (phone) => phone,
  },
  {
    key: 'instagram',
    tileClass: 'instagram-gradient text-white',
    icon: 'lucideInstagram',
    href: instagramUrl,
    label: () => 'Instagram',
  },
  { key: 'website', tileClass: 'bg-(--ed-chip-bg) text-(--ed-chip-fg)', icon: 'lucideGlobe', label: hostname },
  {
    key: 'email',
    tileClass: 'bg-(--ed-chip-bg) text-(--ed-chip-fg)',
    icon: 'lucideMail',
    href: (email) => `mailto:${email}`,
    label: (email) => email,
    sameTab: true,
  },
  { key: 'facebook', tileClass: 'bg-[#1877F2] text-white', icon: 'lucideFacebook', label: () => 'Facebook' },
  { key: 'tiktok', tileClass: 'bg-black text-white', svgPath: TIKTOK_PATH, label: () => 'TikTok' },
  { key: 'youtube', tileClass: 'bg-[#FF0000] text-white', icon: 'lucideYoutube', label: () => 'YouTube' },
];

/** "https://www.scuola.it/contatti" → "scuola.it". */
function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Sito web';
  }
}

/**
 * A venue's page (school, club, bar...), opened from its card on /mappa.
 * Same look as the event page: it borrows event-details.css (theme tokens,
 * glass cards, buttons) instead of copying it, so the two stay in step.
 */
@Component({
  selector: 'app-venue-details',
  templateUrl: './venue-details.html',
  styleUrl: '../event-details/event-details.css',
  imports: [SidebarPushDirective, NgIcon, MapPreview, VenuePinIcon],
  providers: [
    provideIcons({ lucideArrowLeft, lucideFacebook, lucideGlobe, lucideInstagram, lucideMail, lucideYoutube }),
  ],
})
export class VenueDetails {
  private readonly venuesService = inject(VenuesService);

  protected readonly venue = signal<VenueDetailDto | null>(null);
  protected readonly loading = signal(true);

  /** Opened from a shared link, to the map instead — see injectGoBack. */
  protected readonly goBack = injectGoBack('/mappa');

  protected readonly typeLabels = VENUE_TYPE_LABELS;
  /** Same colour as the venue's badge on the map (drawn on the mini-map,
   * which reads as a crop of it). */
  protected readonly pinColors = VENUE_PIN_COLORS;
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

  constructor() {
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
}
