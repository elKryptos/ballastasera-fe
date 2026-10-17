import type { ImageOverlay, Map as LeafletMap } from 'leaflet';
import type { Theme } from '../../core/services/theme.service';
import { MILAN_CENTER, MILAN_DEFAULT_ZOOM } from '../../core/config/map-pins';

/** The pictures, rendered by scripts/build-map-snapshots.mjs (the mappa-*
 * variants: keep sizes and view in step with it) — /mappa's first view,
 * MILAN_CENTER at MILAN_DEFAULT_ZOOM, without labels. The smallest one that
 * covers the map is used: a phone's fits in the small one. */
const SIZES = [
  { name: 'mappa-small', width: 800, height: 1000 },
  { name: 'mappa-large', width: 1920, height: 1280 },
];

const FADE_MS = 300;

/**
 * A static picture of the basemap under /mappa's pins while the live one
 * loads — MapLibre's chunk, its style and the first tiles take a few round
 * trips, the pins only one, so without it the pins would sit on bare land
 * colour for a second or two. Put on the map by its geographic bounds, so it
 * pans and zooms with it and lines up with the real map wherever it shows.
 * Only near the zoom it was drawn at: further in it would be a blur, further
 * out a small square. Browser only.
 */
export class MapPlaceholder {
  private overlay: ImageOverlay | null = null;
  private readonly name: string;

  constructor(L: typeof import('leaflet'), map: LeafletMap, theme: Theme) {
    const size = map.getSize();
    const picked = SIZES.find((s) => s.width >= size.x && s.height >= size.y) ?? SIZES[SIZES.length - 1];
    this.name = picked.name;

    const centre = map.project(MILAN_CENTER, MILAN_DEFAULT_ZOOM);
    const half = L.point(picked.width / 2, picked.height / 2);
    const bounds = L.latLngBounds(
      map.unproject(centre.subtract(half), MILAN_DEFAULT_ZOOM),
      map.unproject(centre.add(half), MILAN_DEFAULT_ZOOM),
    );
    if (Math.abs(map.getZoom() - MILAN_DEFAULT_ZOOM) > 1 || !bounds.intersects(map.getBounds())) return;

    this.overlay = L.imageOverlay(this.url(theme), bounds, { interactive: false }).addTo(map);
  }

  setTheme(theme: Theme): void {
    this.overlay?.setUrl(this.url(theme));
  }

  /** Fades out over the live basemap, then goes. */
  remove(): void {
    const overlay = this.overlay;
    if (!overlay) return;
    this.overlay = null;
    const image = overlay.getElement();
    if (image) image.style.transition = `opacity ${FADE_MS}ms`;
    overlay.setOpacity(0);
    setTimeout(() => overlay.remove(), FADE_MS);
  }

  private url(theme: Theme): string {
    return `/map-snapshots/${this.name}-${theme}.webp`;
  }
}
