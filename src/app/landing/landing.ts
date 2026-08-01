import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmbedKind, MediaEmbed } from '../media-embed/media-embed';

type FormState = 'idle' | 'error' | 'done';

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
  imports: [FormsModule, MediaEmbed],
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
      title: 'Guarda com’è una serata',
      credit: '@ballastasera',
      hint: 'Premi play — parte con l’audio',
    },
  ];

  /** One bar of salsa. Beats 4 and 8 are held, not stepped. */
  protected readonly beats = [1, 2, 3, 4, 5, 6, 7, 8];

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
