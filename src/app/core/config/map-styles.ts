import type { Theme } from '../services/theme.service';

/** The basemap, one MapLibre style per theme over OpenFreeMap's vector tiles
 * (free, no API key, no request limits, commercial use allowed), generated
 * into public/ by scripts/build-map-styles.mjs (`pnpm map:styles`): the same
 * layers recoloured Voyager-like (light) and Google-"night"-like (dark), metro
 * and train stations as the only POIs. Shared by /mappa and every map
 * preview (MapPreview), so they all look like the same map. Each style's land
 * colour (its "background" layer) is repeated in CSS — --map-land in map.css,
 * --preview-land in map-preview.css — for the moment before tiles load. */
export const MAP_STYLE_URLS: Record<Theme, string> = {
  light: '/map-styles/light.json',
  dark: '/map-styles/dark.json',
};
