import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

const YT_ORIGIN = 'https://www.youtube-nocookie.com';

/**
 * True once the frame holds a document from another origin — i.e. YouTube has
 * actually landed. Reading `location.href` across origins throws; on the blank
 * document the iframe starts out with, it reads back fine.
 */
function isForeign(win: Window): boolean {
  try {
    void win.location.href;
    return false;
  } catch {
    return true;
  }
}

export type EmbedKind = 'youtube' | 'instagram';

/**
 * Click-to-load embed. Nothing from YouTube or Instagram is requested until the
 * visitor presses play, so the page ships no third-party cookies on load and
 * needs no consent banner for them. The click is also the gesture that lets the
 * video start with its sound on.
 */
@Component({
  selector: 'app-media-embed',
  templateUrl: './media-embed.html',
  styleUrl: './media-embed.css',
})
export class MediaEmbed {
  private readonly sanitizer = inject(DomSanitizer);

  readonly kind = input.required<EmbedKind>();

  /** YouTube video id, or the Instagram post shortcode from /p/<shortcode>/. */
  readonly mediaId = input.required<string>();

  readonly title = input.required<string>();

  /** Whose post this is, shown as attribution. e.g. "@ballastasera". */
  readonly credit = input<string>();

  /** Overrides the default "Riproduci da YouTube" line under the title. */
  readonly hint = input<string>();

  /**
   * Poster image. Self-host it to keep the page free of third-party requests;
   * YouTube falls back to its own thumbnails when this is empty.
   */
  readonly poster = input<string>();

  /**
   * Whether the video is playing. Two-way, so a control elsewhere on the page
   * can start it — or stop it. On YouTube that pauses the player and keeps the
   * position; Instagram has no such control, so it unmounts instead.
   */
  readonly open = model(false);

  /**
   * Latches on the first play and stays on for YouTube, so toggling pauses the
   * player rather than remounting the iframe and restarting from the top.
   */
  protected readonly mounted = signal(false);

  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');

  /**
   * A fresh iframe sits on about:blank, which is same-origin with the page, so
   * a command sent before YouTube's document is in there is rejected. The load
   * event fires for that blank document too, hence the origin check below.
   */
  private readonly frameReady = signal(false);

  constructor() {
    effect(() => {
      if (this.open()) {
        this.mounted.set(true);
      } else if (this.kind() !== 'youtube') {
        this.mounted.set(false);
        this.frameReady.set(false);
      }
    });

    // The first play autoplays on mount; every toggle after that is a command.
    effect(() => {
      const playing = this.open();
      const win = this.frame()?.nativeElement.contentWindow;
      if (!win || !this.frameReady() || this.kind() !== 'youtube') return;
      if (!isForeign(win)) return;

      win.postMessage(
        JSON.stringify({
          event: 'command',
          func: playing ? 'playVideo' : 'pauseVideo',
          args: [],
        }),
        YT_ORIGIN,
      );
    });
  }

  /** Walks the poster candidates; past the end, the plain card shows instead. */
  private readonly posterStep = signal(0);

  private readonly posterCandidates = computed(() => {
    const own = this.poster();
    if (own) return [own];
    if (this.kind() !== 'youtube') return [];
    // maxresdefault only exists for HD uploads; hqdefault always does.
    const id = this.mediaId();
    return [
      `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    ];
  });

  protected readonly posterUrl = computed(
    () => this.posterCandidates()[this.posterStep()] ?? '',
  );

  protected readonly hintLine = computed(
    () => this.hint() || `Riproduci da ${this.kind() === 'youtube' ? 'YouTube' : 'Instagram'}`,
  );

  protected readonly embedUrl = computed<SafeResourceUrl>(() => {
    // enablejsapi lets the hero button pause and resume the player from afar;
    // playsinline keeps iOS from hijacking the screen with its own fullscreen.
    const url =
      this.kind() === 'youtube'
        ? `${YT_ORIGIN}/embed/${this.mediaId()}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1`
        : `https://www.instagram.com/p/${this.mediaId()}/embed/`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  protected onFrameLoad(): void {
    const win = this.frame()?.nativeElement.contentWindow;
    if (win && isForeign(win)) this.frameReady.set(true);
  }

  protected nextPoster(): void {
    this.posterStep.update((step) => step + 1);
  }

  protected load(): void {
    this.open.set(true);
  }
}
