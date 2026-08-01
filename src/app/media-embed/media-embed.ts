import { Component, computed, inject, input, model, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

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
   * Whether the real embed is mounted. Two-way, so a control elsewhere on the
   * page can start it — or stop it, which unmounts the iframe and cuts the sound.
   */
  readonly open = model(false);

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
    const url =
      this.kind() === 'youtube'
        ? `https://www.youtube-nocookie.com/embed/${this.mediaId()}?autoplay=1&rel=0&modestbranding=1`
        : `https://www.instagram.com/p/${this.mediaId()}/embed/`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  protected nextPoster(): void {
    this.posterStep.update((step) => step + 1);
  }

  protected load(): void {
    this.open.set(true);
  }
}
