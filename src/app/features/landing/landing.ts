import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgClass, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { Map as LeafletMap } from 'leaflet';
import { EmbedKind, MediaEmbed } from '../../shared/media-embed/media-embed';
import { Navbar } from '../../shared/navbar/navbar';
import { InstallBanner } from '../../shared/install-banner/install-banner';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { FEATURE_FLAGS } from '../../core/config/feature-flags';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { writeLangCookie } from '../../core/i18n/lang-cookie';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { MILAN_CENTER, MILAN_DEFAULT_ZOOM, PIN_GLYPHS, PIN_SHAPES, PIN_TYPES } from '../../core/config/map-pins';
import { environment } from '../../../environments/environment';

interface PartnerCard {
  /** Which drawing sits on top of the card when there is nothing else to show. */
  art: 'venue' | 'school' | 'events';
  label: string;
  copy: string;
  /**
   * Self-hosted clip in public/social/, e.g. '/social/locali.mp4'. Takes over
   * from `reel` the moment it's set — drop the file at that exact path and the
   * card switches on its own, no other change needed.
   */
  video?: string;
  /** Poster frame for `video`, e.g. '/social/locali.jpg'. Shown before play. */
  poster?: string;
  /** Instagram shortcode from instagram.com/p|reel/<shortcode>/. Used with permission. */
  reel?: string;
  /** Title read out for the reel's play card. Required when `reel` is set. */
  reelTitle?: string;
  /** Real creator credit shown under the card, e.g. "Marisella Maritato". */
  creditName?: string;
  /** Their handle, without the @. Links to instagram.com/<handle>. */
  creditHandle?: string;
}

/** One pin kind from the real map's legend, reproduced here so visitors
 * already recognise the shapes and colours once the map itself opens. */
interface PinLegendItem {
  label: string;
  color: string;
  shape: string;
  glyph: string;
}

interface MediaItem {
  kind: EmbedKind;
  /** YouTube video id, or the Instagram shortcode from instagram.com/p/<shortcode>/. */
  mediaId: string;
  title: string;
  credit: string;
  /** Replaces the default line under the title on the play card. */
  hint?: string;
  /** Optional self-hosted thumbnail in public/, e.g. '/social/tunnel.jpg'. */
  poster?: string;
}

@Component({
  selector: 'app-landing',
  imports: [RouterLink, MediaEmbed, Navbar, NgClass, TranslocoPipe, SidebarPushDirective, InstallBanner],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing implements AfterViewInit, OnDestroy {
  // Keeps the redesigned navbar + login/signup dialog off the public site
  // until it's signed off on staging — see environment.staging.ts. The
  // production header below stays byte-for-byte what already shipped.
  protected readonly showNewNavbar = inject(FeatureFlagService).isEnabled(FEATURE_FLAGS.navbarAuth);

  private readonly transloco = inject(TranslocoService);

  protected isActiveLang(lang: string): boolean {
    return this.transloco.getActiveLang() === lang;
  }

  protected setLang(lang: string): void {
    this.transloco.setActiveLang(lang);
    writeLangCookie(lang);
  }

  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private revealObserver?: IntersectionObserver;
  private mapObserver?: IntersectionObserver;
  /** Aborts every pointer listener this component attaches (ambient parallax,
   * map tilt) in one shot — see ngOnDestroy. */
  private readonly listenerAbort = new AbortController();

  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  /** Container for the live map preview in the map-teaser section. */
  private readonly miniMapContainer = viewChild<ElementRef<HTMLDivElement>>('miniMap');
  private miniMap: LeafletMap | null = null;
  private readonly teaserVisual = viewChild<ElementRef<HTMLAnchorElement>>('teaserVisual');

  async ngAfterViewInit(): Promise<void> {
    this.setupRevealAnimations();
    if (this.isBrowser) {
      if (!this.prefersReducedMotion()) {
        this.setupAmbientParallax();
        this.setupTeaserTilt();
      }
      this.setupLazyMiniMap();
    }
  }

  private prefersReducedMotion(): boolean {
    return this.isBrowser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * The hero's "rise" cascade only plays on load, so anything below the fold
   * — reached by scrolling, not by that initial timer — never got it. This
   * mirrors the same entrance for every `.reveal` section as it comes into view.
   */
  private setupRevealAnimations(): void {
    const host = this.elementRef.nativeElement as HTMLElement;
    const targets: NodeListOf<HTMLElement> = host.querySelectorAll('.reveal');
    if (!targets.length || typeof IntersectionObserver === 'undefined') {
      return;
    }

    if (this.prefersReducedMotion()) {
      targets.forEach((el) => el.classList.add('in-view'));
      return;
    }

    this.revealObserver = new IntersectionObserver(
      (entries, observer) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0, rootMargin: '0px 0px -5% 0px' },
    );

    targets.forEach((el) => this.revealObserver!.observe(el));
  }

  /**
   * Drifts the fixed ambient glow (see .glow in landing.css) a few percent
   * with the cursor, set on the host element so .glow — a child — picks up
   * --mx/--my through ordinary CSS inheritance. rAF-throttled since
   * pointermove can fire far faster than the screen repaints.
   */
  private setupAmbientParallax(): void {
    const host = this.elementRef.nativeElement as HTMLElement;
    let frame = 0;

    document.addEventListener(
      'pointermove',
      (event: PointerEvent) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          host.style.setProperty('--mx', String(event.clientX / window.innerWidth));
          host.style.setProperty('--my', String(event.clientY / window.innerHeight));
        });
      },
      { passive: true, signal: this.listenerAbort.signal },
    );
  }

  /**
   * The map preview tilts toward the cursor and reveals a spotlight under
   * it (see .teaser-visual in landing.css) — a small "it's alive" flourish
   * on the section's hero element, reset flat on pointerleave.
   */
  private setupTeaserTilt(): void {
    const el = this.teaserVisual()?.nativeElement;
    if (!el) return;

    el.addEventListener(
      'pointermove',
      (event: PointerEvent) => {
        const rect = el.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        el.style.setProperty('--tiltx', `${(px - 0.5) * 10}deg`);
        el.style.setProperty('--tilty', `${(0.5 - py) * 10}deg`);
        el.style.setProperty('--spot-x', `${px * 100}%`);
        el.style.setProperty('--spot-y', `${py * 100}%`);
      },
      { passive: true, signal: this.listenerAbort.signal },
    );

    el.addEventListener(
      'pointerleave',
      () => {
        el.style.setProperty('--tiltx', '0deg');
        el.style.setProperty('--tilty', '0deg');
      },
      { signal: this.listenerAbort.signal },
    );
  }

  /**
   * Loading Leaflet + fetching basemap tiles is real weight (a JS chunk and
   * network requests) that a visitor who never scrolls this far shouldn't
   * pay for — deferred until the box is about to enter the viewport, not
   * fired unconditionally on every landing pageview. rootMargin starts the
   * load a bit early so the tiles are usually already in by the time the
   * box is actually visible, instead of popping in empty.
   */
  private setupLazyMiniMap(): void {
    const container = this.miniMapContainer()?.nativeElement;
    if (!container || typeof IntersectionObserver === 'undefined') {
      void this.initMiniMap();
      return;
    }

    this.mapObserver = new IntersectionObserver(
      (entries, observer) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void this.initMiniMap();
        }
      },
      { rootMargin: '200px 0px' },
    );
    this.mapObserver.observe(container);
  }

  /**
   * A live, read-only preview of the real map (see MapPage) — the same
   * basemap, panning/zooming disabled. No events are fetched here: that hits
   * the backend and stays reserved for MapPage, once the visitor actually
   * opens /mappa.
   */
  private async initMiniMap(): Promise<void> {
    const container = this.miniMapContainer()?.nativeElement;
    if (!container) return;

    // Leaflet is CJS/UMD, not real ESM: esbuild's production bundle can
    // synthesize a namespace that only has the module under `.default`
    // instead of spreading it onto the namespace itself (works either way
    // in dev, breaks silently in the optimized prod build).
    const leafletModule = await import('leaflet');
    const L = 'map' in leafletModule ? leafletModule : (leafletModule as unknown as { default: typeof leafletModule }).default;
    this.miniMap = L.map(container, {
      center: MILAN_CENTER,
      zoom: MILAN_DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
    });

    L.tileLayer(
      `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${environment.cartoApiKey}`,
      { subdomains: 'abcd', maxZoom: 20 },
    ).addTo(this.miniMap);
  }

  ngOnDestroy(): void {
    this.revealObserver?.disconnect();
    this.mapObserver?.disconnect();
    this.listenerAbort.abort();
    this.miniMap?.remove();
  }

  /**
   * Empty this array and the "Si balla così" section drops out of the page.
   *
   * Only post content you own or have been given permission to use — a public
   * account is not a licence, the copyright stays with whoever shot it.
   * `kind: 'instagram'` takes the shortcode from instagram.com/p/<shortcode>/.
   */
  protected readonly media: MediaItem[] = [
    {
      kind: 'youtube',
      mediaId: 'p_pU5sSRSPA',
      title: 'Guarda come si balla la bachata',
      credit: '@ballastasera',
      hint: 'Premi play — parte con l’audio',
    },
  ];

  /**
   * One bar of bachata, split the way it is danced: four beats travelling right,
   * four travelling left. Beats 4 and 8 are the tap, not a step.
   */
  protected readonly phrases = [
    { direction: 'count.right', beats: [1, 2, 3, 4] },
    { direction: 'count.left', beats: [5, 6, 7, 8] },
  ];

  /**
   * Who the "stiamo arrivando" pitch is addressed to, one card each.
   *
   * The clips are friends' content, used with their permission — the credit
   * under each card links to their real profile, not ours. Until the mp4s
   * below exist on disk, each card falls back to the live Instagram embed.
   */
  protected readonly partners: PartnerCard[] = [
    {
      art: 'events',
      video: '/social/eventi.mp4',
      poster: '/social/eventi.jpg',
      reel: 'DbEFvfVMo7N',
      reelTitle: 'partners.events.reelTitle',
      creditName: 'MILATINO Milano',
      creditHandle: 'milatino2.0',
      label: 'partners.events.label',
      copy: 'partners.events.copy',
    },
    {
      art: 'venue',
      video: '/social/locali.mp4',
      poster: '/social/locali.jpg',
      reel: 'DbgIhnLiFAH',
      reelTitle: 'partners.venue.reelTitle',
      creditName: 'Marisella Maritato',
      creditHandle: 'marisellamaritato',
      label: 'partners.venue.label',
      copy: 'partners.venue.copy',
    },
    {
      art: 'school',
      video: '/social/scuole.mp4',
      poster: '/social/scuole.jpg',
      reel: 'DW1MUthDGAb',
      reelTitle: 'partners.school.reelTitle',
      creditName: 'Noelia Otero',
      creditHandle: 'noeliaoterobs',
      label: 'partners.school.label',
      copy: 'partners.school.copy',
    },
  ];

  /**
   * Indices whose self-hosted clip 404'd — falls back to the Instagram embed
   * for that card. Lets the video paths above sit ready before the files do.
   */
  protected readonly videoErrors = signal(new Set<number>());

  protected onVideoError(index: number): void {
    this.videoErrors.update((set) => new Set(set).add(index));
  }

  protected readonly year = new Date().getFullYear();

  /** Shared with the embed, so the hero button can start it from off-screen. */
  protected readonly videoOpen = signal(false);

  /** Maps each EventType to the transloco key its legend chip shows. */
  private static readonly LEGEND_LABEL_KEYS: Record<string, string> = {
    EVENT: 'legend.event',
    SCHOOL: 'legend.school',
    CLUB: 'legend.club',
    BAR: 'legend.bar',
  };

  /** Same theme tokens the rest of the UI uses for these accents — kept as
   * CSS vars here (unlike PIN_COLORS' raw hex) so this flat legend list
   * follows the current theme. */
  private static readonly LEGEND_COLOR_VARS: Record<string, string> = {
    EVENT: 'var(--color-rose)',
    SCHOOL: 'var(--color-violet)',
    CLUB: 'var(--color-mint)',
    BAR: 'var(--color-amber)',
  };

  /** Shape/glyph sourced from the same map-pins config the real map and the
   * live preview above use, so all three surfaces can't drift apart. */
  protected readonly legendPins: PinLegendItem[] = PIN_TYPES.map((type) => ({
    label: Landing.LEGEND_LABEL_KEYS[type],
    color: Landing.LEGEND_COLOR_VARS[type],
    shape: PIN_SHAPES[type],
    glyph: PIN_GLYPHS[type],
  }));

  protected toggleMusic(): void {
    this.videoOpen.update((open) => !open);
  }

  protected isHeld(beat: number): boolean {
    return beat % 4 === 0;
  }
}
