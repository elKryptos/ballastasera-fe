/** What the map shows: event pins (the default), venue badges only, the
 * schools among them only, or events and venues both. */
export type MapLayer = 'events' | 'venues' | 'schools' | 'both';

export const LAYER_OPTIONS: { value: MapLayer; label: string }[] = [
  { value: 'events', label: 'Serate' },
  { value: 'venues', label: 'Locali e scuole' },
  { value: 'schools', label: 'Scuole' },
  { value: 'both', label: 'Entrambi' },
];

/** Active-filter chip for a non-default layer (the default shows none). */
export const LAYER_CHIPS: Record<MapLayer, string | null> = {
  events: null,
  venues: 'Solo locali e scuole',
  schools: 'Solo scuole',
  both: 'Serate + locali',
};

/** Event pins on this layer. */
export function layerShowsEvents(layer: MapLayer): boolean {
  return layer === 'events' || layer === 'both';
}
