import {
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SidebarPushDirective } from '../../../shared/directives/sidebar-push.directive';
import { LessonHeading } from '../heading/lesson-heading';
import { loadLessonFonts } from '../lesson-fonts';
import { Reveal } from '../reveal.directive';
import { SpotifyController, spotifyApi } from './spotify-player';

type Side = 'A' | 'B';

interface Track {
  title: string;
  artist: string;
  year: number;
  /**
   * Spotify track id, for the preview player — each checked against Spotify's
   * oEmbed (title and artist). Without one the row only lists the song.
   */
  spotify?: string;
}

const SIDES: Record<Side, { dance: string; tracks: Track[] }> = {
  A: {
    dance: 'Salsa',
    tracks: [
      { title: 'Llorarás', artist: 'Oscar D’León, Dimensión Latina', year: 1975, spotify: '1wQQNCFJQtaU4EvsGPZJML' },
      { title: 'Pa’llá voy', artist: 'Marc Anthony', year: 2021, spotify: '05jVbjHBsX3V8OxFWlpayR' },
      { title: 'Aguanile', artist: 'Marc Anthony', year: 2007, spotify: '0Bf3bLtRSlpXl5l5MuzZd6' },
      { title: 'Deseándote', artist: 'Frankie Ruiz', year: 1989, spotify: '5hiHDuJOcBmB8wguFDPFjD' },
      { title: 'Desnúdate mujer', artist: 'Frankie Ruiz', year: 1987, spotify: '5gH9swPA4CDuuRrXeKkvPX' },
      { title: 'Vivir mi vida', artist: 'Marc Anthony', year: 2013, spotify: '3QHMxEOAGD51PDlbFPHLyJ' },
      { title: 'Yo no sé mañana', artist: 'Luis Enrique', year: 2009, spotify: '7nDIflSHQXzaa8zupxwv3U' },
      { title: 'Fabricando fantasías', artist: 'Tito Nieves', year: 2004, spotify: '4WxQ7uhyoLJXcwmmX7Zmkk' },
    ],
  },
  B: {
    dance: 'Bachata',
    tracks: [
      { title: 'Obsesión', artist: 'Aventura', year: 2002, spotify: '3VhIlnjnpEgOjVdLHdlCoV' },
      { title: 'Bachata en las venas', artist: 'Esme, Akai Rojas', year: 2024, spotify: '73xOg6WHnYUWmqU87pWblc' },
      { title: 'La estrella', artist: 'JR', year: 2019, spotify: '5RSeiHJVaCVaehLj2D4PM5' },
      { title: 'Propuesta indecente', artist: 'Romeo Santos', year: 2013, spotify: '7H9dYcwQ2it4PhpdA2NIGt' },
      { title: 'Eres mía', artist: 'Romeo Santos', year: 2014, spotify: '6I86RF3odBlcuZA9Vfjzeq' },
      { title: 'Darte un beso', artist: 'Prince Royce', year: 2013, spotify: '6cJLfIqwh0tCKRjYM3WpZ5' },
      { title: 'Me emborracharé', artist: 'Grupo Extra', year: 2017, spotify: '2g97AfsrryNZVFmdqKGRuN' },
      { title: 'Dile al amor', artist: 'Aventura', year: 2010, spotify: '6lFM8kkmpffm0aq2gzEtEK' },
    ],
  },
};

/**
 * /playlist: salsa and bachata to dance to, as a mixtape — side A salsa,
 * side B bachata, classics and newer songs alike (whatever SIDES holds).
 * Flipping the side turns the cassette over. A page of its own, one tap
 * away in the sidebar; the lesson's last chapter leads here too. Same look
 * as the lesson, by night and by day (lesson-look.css, loadLessonFonts).
 *
 * Each song plays in Spotify's own embedded player, unfolded under its row:
 * a 30-second preview, or the whole song for whoever is signed in to
 * Spotify. One click on the row's button opens the player and starts it,
 * through Spotify's iFrame API; on the open song the same button pauses and
 * resumes. Browsers that won't let a page start a cross-origin player
 * (Safari, at times) leave it waiting for its own play button instead.
 *
 * Click-to-load, like MediaEmbed: nothing from Spotify — not even the API's
 * script — is requested until a song is opened, so the page carries no
 * third-party cookies on load. One song at a time.
 */
@Component({
  selector: 'app-playlist',
  imports: [SidebarPushDirective, LessonHeading, Reveal],
  templateUrl: './playlist.html',
  styleUrls: ['../lesson-look.css', './playlist.css'],
})
export class Playlist {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  protected readonly faces = (['A', 'B'] as const).map((side) => ({ side, dance: SIDES[side].dance }));
  protected readonly side = signal<Side>('A');
  protected readonly current = computed(() => SIDES[this.side()]);

  /** The Spotify id of the song whose player is open, if any. */
  protected readonly open = signal<string | null>(null);
  /** Whether the open player is paused: the row's button shows play or pause from it. */
  protected readonly paused = signal(true);
  /** The iFrame API couldn't load: fall back to the plain embed, started from its own button. */
  protected readonly plain = signal(false);

  /** For the plain fallback. Memoised: a fresh SafeResourceUrl on every check would reload the iframe. */
  protected readonly embedUrl = computed<SafeResourceUrl | null>(() => {
    const id = this.open();
    return id ? this.sanitizer.bypassSecurityTrustResourceUrl(`https://open.spotify.com/embed/track/${id}?theme=0`) : null;
  });

  /** The open row's slot for the player. */
  private readonly slot = viewChild<ElementRef<HTMLElement>>('player');
  private controller?: SpotifyController;

  constructor() {
    loadLessonFonts(this.document);
    inject(DestroyRef).onDestroy(() => this.close());
  }

  protected flip(side: Side): void {
    this.side.set(side);
    this.close();
  }

  protected buttonLabel(track: Track): string {
    if (this.open() !== track.spotify) return `Ascolta un’anteprima di ${track.title}`;
    if (!this.controller) return `Chiudi ${track.title}`;
    return `${this.paused() ? 'Riprendi' : 'Metti in pausa'} ${track.title}`;
  }

  /** A new song: open its player and start it. The open one: pause or resume it. */
  protected listen(track: Track): void {
    const id = track.spotify;
    if (!id) return;
    if (this.open() === id) {
      if (this.controller) this.controller.togglePlay();
      else this.close();
      return;
    }
    this.close();
    this.open.set(id);
    if (!this.plain()) afterNextRender(() => this.mount(id), { injector: this.injector });
  }

  private mount(id: string): void {
    const slot = this.slot()?.nativeElement;
    if (!slot) return;
    // The API swaps the element it's given for its iframe: hand it one of our
    // own, inside the slot, so the iframe leaves with the row when it closes.
    const target = this.document.createElement('div');
    slot.appendChild(target);
    spotifyApi(this.document).then(
      (api) =>
        api.createController(target, { uri: `spotify:track:${id}`, width: '100%', height: 80 }, (controller) => {
          if (this.open() !== id) {
            controller.destroy();
            return;
          }
          this.controller = controller;
          controller.addListener('playback_update', ({ data }) => this.paused.set(data.isPaused));
          // Still the click that opened it, as far as the browser's autoplay rules go.
          controller.addListener('ready', () => controller.play());
        }),
      () => this.plain.set(true),
    );
  }

  private close(): void {
    this.controller?.destroy();
    this.controller = undefined;
    this.open.set(null);
    this.paused.set(true);
  }
}
