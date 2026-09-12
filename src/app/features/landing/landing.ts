import { AfterViewInit, Component, ElementRef, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmbedKind, MediaEmbed } from '../../shared/media-embed/media-embed';
import { Navbar } from '../../shared/navbar/navbar';
import { AuthModal } from '../../shared/auth-modal/auth-modal';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { FEATURE_FLAGS } from '../../core/config/feature-flags';
import { NgClass } from '@angular/common';

type FormState = 'idle' | 'error' | 'done';

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

/** A made-up night on the teaser map: position is a % of the panel. */
interface MapPin {
  x: number;
  y: number;
  zone: string;
  style: string;
}

/** One pin kind from the real map's legend, reproduced here so visitors
 * already recognise the shapes and colours once the map itself opens. */
interface PinLegendItem {
  label: string;
  color: string;
  shape: string;
  glyph: string;
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
  imports: [FormsModule, MediaEmbed, Navbar, AuthModal, NgClass],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing implements AfterViewInit, OnDestroy {
  // Keeps the redesigned navbar + login/signup dialog off the public site
  // until it's signed off on staging — see environment.staging.ts. The
  // production header below stays byte-for-byte what already shipped.
  protected readonly showNewNavbar = inject(FeatureFlagService).isEnabled(FEATURE_FLAGS.navbarAuth);

  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private revealObserver?: IntersectionObserver;

  /**
   * The hero's "rise" cascade only plays on load, so anything below the fold
   * — reached by scrolling, not by that initial timer — never got it. This
   * mirrors the same entrance for every `.reveal` section as it comes into view.
   */
  ngAfterViewInit(): void {
    const host = this.elementRef.nativeElement as HTMLElement;
    const targets: NodeListOf<HTMLElement> = host.querySelectorAll('.reveal');
    if (!targets.length || typeof IntersectionObserver === 'undefined') {
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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

  ngOnDestroy(): void {
    this.revealObserver?.disconnect();
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
      mediaId: 'MMfmLVvVTzg',
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
    { direction: 'destra', beats: [1, 2, 3, 4] },
    { direction: 'sinistra', beats: [5, 6, 7, 8] },
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
      reelTitle: 'Un evento, raccontato bene',
      creditName: 'MILATINO Milano',
      creditHandle: 'milatino2.0',
      label: 'Organizzatori e social',
      copy: 'Social, festival e one night: un posto solo dove finiscono tutte le date.',
    },
    {
      art: 'venue',
      video: '/social/locali.mp4',
      poster: '/social/locali.jpg',
      reel: 'DbgIhnLiFAH',
      reelTitle: 'Una serata in pista',
      creditName: 'Marisella Maritato',
      creditHandle: 'marisellamaritato',
      label: 'Locali e discoteche',
      copy: 'Le tue serate latine sulla mappa di chi le sta cercando, la sera stessa.',
    },
    {
      art: 'school',
      video: '/social/scuole.mp4',
      poster: '/social/scuole.jpg',
      reel: 'DW1MUthDGAb',
      reelTitle: 'Una lezione, da vicino',
      creditName: 'Noelia Otero',
      creditHandle: 'noeliaoterobs',
      label: 'Scuole e maestri',
      copy: 'Corsi, stage e prove aperte, davanti a chi ha appena deciso di iniziare.',
    },
  ];

  /**
   * Fake nights for the teaser map — no real venue is named, and nothing here
   * is fetched: it is a drawing of what the map will do, not the map.
   */
  /** Column positions for the streets drawn under the pins. */
  protected readonly mapGrid = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  protected readonly mapPins: MapPin[] = [
    { x: 30, y: 28, zone: 'Navigli', style: 'Bachata' },
    { x: 62, y: 20, zone: 'Isola', style: 'Salsa cubana' },
    { x: 48, y: 52, zone: 'Centro', style: 'Kizomba' },
    { x: 76, y: 63, zone: 'Lambrate', style: 'Social' },
    { x: 18, y: 66, zone: 'Barona', style: 'Corso base' },
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

  protected readonly email = signal('');
  protected readonly state = signal<FormState>('idle');

  /** Shared with the embed, so the hero button can start it from off-screen. */
  protected readonly videoOpen = signal(false);

  /** Opened by the "Accedi con Google" CTA in the live-map teaser section. */
  protected readonly mapAuthOpen = signal(false);

  /**
   * Same colour, outline and glyph per type as `PIN_COLORS` / `PIN_SHAPES` /
   * `PIN_GLYPHS` in map.ts — kept in sync by hand since the two features
   * don't share a module. Each shape fills a 24x32 viewBox, tip at (12, 32);
   * each glyph is drawn in white centred around (12, 12).
   */
  protected readonly legendPins: PinLegendItem[] = [
    {
      label: 'Evento',
      color: 'var(--color-rose)',
      shape: 'M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20c0-6.6-5.4-12-12-12z',
      glyph: 'M12 7.2l1.4 3 3.3.3-2.5 2.2.8 3.3-3-1.8-3 1.8.8-3.3-2.5-2.2 3.3-.3z',
    },
    {
      label: 'Scuola',
      color: 'var(--color-violet)',
      shape: 'M12 0 1 4v9c0 9.4 6.3 15.8 11 19 4.7-3.2 11-9.6 11-19V4z',
      glyph: 'M12 6.5 5 9.5l7 3 7-3zm-4.5 5.2V15c0 1.1 2 2 4.5 2s4.5-.9 4.5-2v-3.3L12 14z',
    },
    {
      label: 'Discoteca',
      color: 'var(--color-mint)',
      shape: 'M12 0 23 7v14L12 32 1 21V7z',
      glyph: 'M14.5 5.5v8.3a2.7 2.7 0 1 1-1-2.1V8h2.8V5.5z',
    },
    {
      label: 'Bar',
      color: 'var(--color-amber)',
      shape: 'M4 0h16a4 4 0 0 1 4 4v14a4 4 0 0 1-1.2 2.9L12 32 1.2 20.9A4 4 0 0 1 0 18V4a4 4 0 0 1 4-4z',
      glyph: 'M7 6h10l-4 5.3V15h2v1H9v-1h2v-3.7z',
    },
  ];

  protected toggleMusic(): void {
    this.videoOpen.update((open) => !open);
  }

  protected isHeld(beat: number): boolean {
    return beat % 4 === 0;
  }

  protected submit(): void {
    const value = this.email().trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      this.state.set('error');
      return;
    }

    // TODO: POST to the waiting-list endpoint once the backend exists.
    this.state.set('done');
  }
}