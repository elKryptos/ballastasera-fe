import type { DivIcon } from 'leaflet';
import { EventType } from '../../core/models/event.model';
import { VenueType } from '../../core/models/venue.model';
import { PIN_COLORS, PIN_GLYPHS, PIN_SHAPES, VENUE_PIN_COLORS, VENUE_PIN_GLYPHS } from '../../core/config/map-pins';

const VENUE_PIN_SIZE = 20;

/** Leaflet icons for the map's markers, built once per look and then reused:
 * an unchanged state is the very same object, which is how MapPage's marker
 * sync tells a pin needs no setIcon(). Takes Leaflet in, since MapPage only
 * loads it in the browser (see ngAfterViewInit). Styled globally in
 * styles.css (.map-pin-wrap, .venue-pin): Leaflet renders markers outside
 * Angular's view. */
export class MapPinIcons {
  private readonly eventIcons = new Map<string, DivIcon>();
  private readonly venueIcons = new Map<string, DivIcon>();

  constructor(private readonly L: typeof import('leaflet')) {}

  event(eventType: EventType, live: boolean, selected: boolean): DivIcon {
    const cacheKey = `${eventType}:${live ? 'live' : 'idle'}:${selected ? 'selected' : 'idle'}`;
    const cached = this.eventIcons.get(cacheKey);
    if (cached) return cached;

    const color = PIN_COLORS[eventType];
    const liveClass = live ? ' map-pin-wrap--live' : '';
    const selectedClass = selected ? ' map-pin-wrap--selected' : '';
    // Live: three outlined rings, staggered by a third of the cycle (negative
    // delays, so they're already spread out on the first frame), plus a LIVE
    // tag that says what the motion means — and stays with motion turned off.
    // Only live pins carry them.
    const liveMarks = live
      ? [0, 0.8, 1.6].map((delay) => `<span class="map-pin-ring" style="animation-delay:-${delay}s"></span>`).join('')
      : '';
    const liveTag = live ? '<span class="map-pin-live-tag"><i></i>LIVE</span>' : '';
    // Selected pin is drawn inverted (white body, outline and glyph in the type
    // colour): the one hollow pin among filled ones stands out on both basemaps
    // and still reads as its type.
    const shapeAttrs = selected
      ? `fill="#fff" stroke="${color}" stroke-width="2" stroke-linejoin="round"`
      : `fill="${color}"`;
    const glyphFill = selected ? color : '#fff';
    const icon = this.L.divIcon({
      className: 'map-pin',
      html: `<span class="map-pin-wrap${liveClass}${selectedClass}" style="color:${color}">
        ${liveMarks}
        <svg viewBox="0 0 24 32" width="24" height="32" xmlns="http://www.w3.org/2000/svg">
          <path d="${PIN_SHAPES[eventType]}" ${shapeAttrs}/>
          <path d="${PIN_GLYPHS[eventType]}" fill="${glyphFill}"/>
        </svg>
        ${liveTag}
      </span>`,
      iconSize: [24, 32],
      iconAnchor: [12, 32],
    });

    this.eventIcons.set(cacheKey, icon);
    return icon;
  }

  /** Round badge in the type's colour with its glyph — see VENUE_PIN_COLORS.
   * Selected, it's drawn inverted (white disc, ring and glyph in the type
   * colour) and grows, the same way a selected event pin stands out. */
  venue(type: VenueType, selected: boolean): DivIcon {
    const cacheKey = `${type}:${selected ? 'selected' : 'idle'}`;
    const cached = this.venueIcons.get(cacheKey);
    if (cached) return cached;

    const color = VENUE_PIN_COLORS[type];
    const half = VENUE_PIN_SIZE / 2;
    const icon = this.L.divIcon({
      className: selected ? 'venue-pin venue-pin--selected' : 'venue-pin',
      html: `<svg viewBox="0 0 24 24" width="${VENUE_PIN_SIZE}" height="${VENUE_PIN_SIZE}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="11" fill="${selected ? '#fff' : color}" stroke="${selected ? color : '#fff'}" stroke-width="2"/>
        <path d="${VENUE_PIN_GLYPHS[type]}" fill="${selected ? color : '#fff'}"/>
      </svg>`,
      iconSize: [VENUE_PIN_SIZE, VENUE_PIN_SIZE],
      iconAnchor: [half, half],
    });

    this.venueIcons.set(cacheKey, icon);
    return icon;
  }
}
