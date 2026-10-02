/** What the map shows: event pins (the default), venue badges only, or both. */
export type MapLayer = 'events' | 'venues' | 'both';

export const LAYER_OPTIONS: { value: MapLayer; label: string }[] = [
  { value: 'events', label: 'Serate' },
  { value: 'venues', label: 'Locali e scuole' },
  { value: 'both', label: 'Entrambi' },
];

/** Active-filter chip for a non-default layer (the default shows none). */
export const LAYER_CHIPS: Record<MapLayer, string | null> = {
  events: null,
  venues: 'Solo locali e scuole',
  both: 'Serate + locali',
};
