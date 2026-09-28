import { Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, viewChild } from '@angular/core';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { MILAN_CENTER, MILAN_DEFAULT_ZOOM } from '../../core/config/map-pins';
import { MAP_STYLE_URLS } from '../../core/config/map-styles';
import { ThemeService } from '../../core/services/theme.service';
import { supportsWebGL } from '../../core/utils/webgl';

/**
 * Read-only live map of a given spot, as a card background (the "Dove" card
 * on an event's page): the same MapLibre styles as /mappa, following the
 * light/dark theme like it does, with every interaction disabled. No events
 * are fetched here — pins, if any, are the parent's own overlay. Size and
 * position come from the classes on the host. Where the map is pure
 * decoration and always shows the same place, MapSnapshot's static picture is
 * far cheaper (the landing, the menu).
 *
 * MapLibre and the tiles are real weight (a JS chunk — shared with /mappa, so
 * it's already cached by the time the visitor opens it — and network requests)
 * that a visitor who never scrolls this far shouldn't pay for, so they wait
 * until the preview is about to enter the viewport. Without WebGL the land
 * colour behind (map-preview.css) stays on its own: the preview is decorative.
 */
@Component({
  selector: 'app-map-preview',
  template: '<div #container class="relative size-full overflow-hidden"></div>',
  styleUrl: './map-preview.css',
  host: { 'aria-hidden': 'true' },
})
export class MapPreview {
  /** [lat, lng], like Leaflet and the rest of the app. */
  readonly center = input<[number, number]>(MILAN_CENTER);
  /** In Leaflet's zoom levels, like MILAN_DEFAULT_ZOOM and /mappa's own view
   * (mapViewState). MapLibre counts in 512px tiles instead of 256px, so the
   * same view is one level lower there — converted below. */
  readonly zoom = input(MILAN_DEFAULT_ZOOM);

  private readonly themeService = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');

  private map: MaplibreMap | null = null;
  private styleUrl: string | null = null;

  constructor() {
    let observer: IntersectionObserver | undefined;

    afterNextRender(() => {
      const container = this.container().nativeElement;
      if (typeof IntersectionObserver === 'undefined') {
        void this.initMap(container);
        return;
      }
      // rootMargin starts the load a bit early, so the map has usually drawn
      // by the time the preview is actually visible, instead of popping in.
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer?.disconnect();
          void this.initMap(container);
        },
        { rootMargin: '200px 0px' },
      );
      observer.observe(container);
    });

    // Restyle when the visitor flips the theme in the sidebar — same tiles,
    // only the colours change, so the switch is instant (as on /mappa). A
    // no-op until initMap() has built the map with the current theme.
    effect(() => {
      const url = MAP_STYLE_URLS[this.themeService.theme()];
      if (!this.map || url === this.styleUrl) return;
      this.styleUrl = url;
      this.map.setStyle(url);
    });

    effect(() => {
      const [lat, lng] = this.center();
      this.map?.jumpTo({ center: [lng, lat], zoom: this.zoom() - 1 });
    });

    this.destroyRef.onDestroy(() => {
      observer?.disconnect();
      this.map?.remove();
      this.map = null;
    });
  }

  private async initMap(container: HTMLDivElement): Promise<void> {
    if (!supportsWebGL()) return;

    // MapLibre is CJS/UMD, not real ESM — same `.default` dance as Leaflet
    // in map.ts, for esbuild's production bundle.
    const maplibreModule = await import('maplibre-gl');
    // Page left while MapLibre loaded: a map built now would never be removed.
    if (this.destroyRef.destroyed) return;
    const maplibregl =
      'Map' in maplibreModule ? maplibreModule : (maplibreModule as unknown as { default: typeof maplibreModule }).default;

    const [lat, lng] = this.center();
    this.styleUrl = MAP_STYLE_URLS[this.themeService.theme()];
    try {
      this.map = new maplibregl.Map({
        container,
        style: this.styleUrl,
        center: [lng, lat],
        zoom: this.zoom() - 1,
        interactive: false,
        attributionControl: false,
      });
    } catch (err) {
      // WebGL there but unusable (e.g. context creation refused): the land
      // colour stays, as without WebGL.
      console.warn('Map preview unavailable', err);
    }
  }
}
