import { Component, input } from '@angular/core';

/**
 * Static picture of the map over Milano, as a card background where a live
 * map would be pure decoration (the landing's map teaser, the menu's Mappa
 * card): a WebP per theme, rendered from /mappa's own styles by
 * scripts/build-map-snapshots.mjs (`pnpm map:snapshots`), so it looks like
 * the real map at the cost of one image — no MapLibre, no tiles. Where the
 * map has to show a real place, use MapPreview instead.
 *
 * Both themes' images are in the DOM, the other one hidden by CSS: with
 * loading="lazy" a hidden image never downloads, so only the current theme's
 * is fetched, and the other only once the visitor switches to it. Size and
 * position come from the classes on the host; the image covers it.
 */
@Component({
  selector: 'app-map-snapshot',
  template: `
    <img class="snapshot snapshot--dark" [src]="'/map-snapshots/' + variant() + '-dark.webp'" alt="" loading="lazy" decoding="async" />
    <img class="snapshot snapshot--light" [src]="'/map-snapshots/' + variant() + '-light.webp'" alt="" loading="lazy" decoding="async" />
  `,
  styleUrl: './map-snapshot.css',
  host: { 'aria-hidden': 'true' },
})
export class MapSnapshot {
  /** Which picture: each is rendered at the aspect of the box it fills (see
   * VARIANTS in the script). */
  readonly variant = input.required<'landing' | 'menu'>();
}
