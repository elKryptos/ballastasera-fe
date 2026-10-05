import { Component, booleanAttribute, input } from '@angular/core';

/**
 * Static picture of the map over Milano, as a card background where a live
 * map would be pure decoration (the landing's map teaser, the menu's Mappa
 * card): a WebP per theme, rendered from /mappa's own styles by
 * scripts/build-map-snapshots.mjs (`pnpm map:snapshots`), so it looks like
 * the real map at the cost of one image — no MapLibre, no tiles. Where the
 * map has to show a real place, use MapPreview instead.
 *
 * Only the current theme's picture is ever downloaded, two ways:
 * - default (below the fold): both themes' <img> are in the DOM, the other
 *   one hidden by CSS. loading="lazy" keeps a hidden image from downloading,
 *   and waits until the picture comes near the screen.
 * - `eager` (above the fold, e.g. the menu): a CSS background per theme
 *   instead. The browser fetches only the background that applies, as soon
 *   as the styles do, with no wait for layout, which lazy images have.
 *   (A hidden eager <img> would download anyway.) The theme is already set
 *   on <html> by index.html's inline script before first paint, so that's
 *   right on the first try, server-rendered or not.
 *
 * Size and position come from the classes on the host; the picture covers it.
 */
@Component({
  selector: 'app-map-snapshot',
  template: `
    @if (!eager()) {
    <img class="snapshot snapshot--dark" [src]="src('dark')" alt="" loading="lazy" decoding="async" />
    <img class="snapshot snapshot--light" [src]="src('light')" alt="" loading="lazy" decoding="async" />
    }
  `,
  styleUrl: './map-snapshot.css',
  host: {
    'aria-hidden': 'true',
    '[style.--snapshot-dark]': 'eager() ? "url(" + src("dark") + ")" : null',
    '[style.--snapshot-light]': 'eager() ? "url(" + src("light") + ")" : null',
  },
})
export class MapSnapshot {
  /** Which picture: each is rendered at the aspect of the box it fills (see
   * VARIANTS in the script). */
  readonly variant = input.required<'landing' | 'menu'>();
  /** On screen as the page opens: load it right away (see above). */
  readonly eager = input(false, { transform: booleanAttribute });

  protected src(theme: 'dark' | 'light'): string {
    return `/map-snapshots/${this.variant()}-${theme}.webp`;
  }
}
