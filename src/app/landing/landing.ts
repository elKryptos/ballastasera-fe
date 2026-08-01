import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmbedKind, MediaEmbed } from '../media-embed/media-embed';
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
  imports: [FormsModule, MediaEmbed, NgClass],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing {
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