import { EventType } from '../models/event.model';
import { VenueType } from '../models/venue.model';

/** Fallback view when there's no city yet to centre on: Milano, zoomed to city level. */
export const MILAN_CENTER: [number, number] = [45.4642, 9.19];
export const MILAN_DEFAULT_ZOOM = 14;

/** Pin colour per EventType, reusing the brand accents from styles.css so every
 * map surface (the real map, the landing teaser) stays inside the same palette. */
export const PIN_COLORS: Record<EventType, string> = {
  EVENT: '#ff4d6d', // rose
  SCHOOL: '#8b5cf6', // violet
  CLUB: '#2dd4bf', // mint
  BAR: '#ffa24c', // amber
};

/** Outer pin outline per EventType — colour alone isn't enough to distinguish
 * them (colourblindness, greyscale printouts), so the shape itself changes too.
 * Each path fills a 24x32 viewBox, tip at (12, 32). */
export const PIN_SHAPES: Record<EventType, string> = {
  // Classic teardrop.
  EVENT: 'M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20c0-6.6-5.4-12-12-12z',
  // Shield.
  SCHOOL: 'M12 0 1 4v9c0 9.4 6.3 15.8 11 19 4.7-3.2 11-9.6 11-19V4z',
  // Hexagon on a point.
  CLUB: 'M12 0 23 7v14L12 32 1 21V7z',
  // Rounded square on a point.
  BAR: 'M4 0h16a4 4 0 0 1 4 4v14a4 4 0 0 1-1.2 2.9L12 32 1.2 20.9A4 4 0 0 1 0 18V4a4 4 0 0 1 4-4z',
};

/** Inner glyph per EventType, drawn in white centred around (12, 12). */
export const PIN_GLYPHS: Record<EventType, string> = {
  // Star.
  EVENT: 'M12 7.2l1.4 3 3.3.3-2.5 2.2.8 3.3-3-1.8-3 1.8.8-3.3-2.5-2.2 3.3-.3z',
  // Graduation cap.
  SCHOOL: 'M12 6.5 5 9.5l7 3 7-3zm-4.5 5.2V15c0 1.1 2 2 4.5 2s4.5-.9 4.5-2v-3.3L12 14z',
  // Music note.
  CLUB: 'M14.5 5.5v8.3a2.7 2.7 0 1 1-1-2.1V8h2.8V5.5z',
  // Cocktail glass.
  BAR: 'M7 6h10l-4 5.3V15h2v1H9v-1h2v-3.7z',
};

/** Every EventType, in the order the legend (and any pin listing) shows them. */
export const PIN_TYPES: EventType[] = ['EVENT', 'SCHOOL', 'CLUB', 'BAR'];

/** Italian label per EventType — the map's legend and the event page's
 * eyebrow ("Scuola · Milano") share it so the wording can't drift apart. */
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  EVENT: 'Evento',
  SCHOOL: 'Scuola',
  CLUB: 'Discoteca',
  BAR: 'Bar',
};

/** Venue pins (the map's "Locali e scuole" layer) are round badges instead of
 * pointed pins, so a permanent place never reads as an event. The types they
 * share with EventType reuse its colour and glyph — a school is violet with a
 * graduation cap whether it's the place or one of its events; OTHER (halls,
 * theatres, squares...) gets a neutral slate and a building glyph. Glyphs are
 * the same paths as PIN_GLYPHS, centred around (12, 12) in a 24x24 viewBox. */
export const VENUE_PIN_COLORS: Record<VenueType, string> = {
  SCHOOL: PIN_COLORS.SCHOOL,
  CLUB: PIN_COLORS.CLUB,
  BAR: PIN_COLORS.BAR,
  OTHER: '#64748b', // slate: white glyph stays >= 4.5:1
};

export const VENUE_PIN_GLYPHS: Record<VenueType, string> = {
  SCHOOL: PIN_GLYPHS.SCHOOL,
  CLUB: PIN_GLYPHS.CLUB,
  BAR: PIN_GLYPHS.BAR,
  // House with a door.
  OTHER: 'M12 6.5 6 11.5V17h4v-3.5h4V17h4v-5.5z',
};

/** Every VenueType, in the order the legend shows them. */
export const VENUE_TYPES: VenueType[] = ['SCHOOL', 'CLUB', 'BAR', 'OTHER'];

/** Italian label per VenueType, for the legend and the venue popup. */
export const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  SCHOOL: 'Scuola',
  CLUB: 'Discoteca',
  BAR: 'Bar',
  OTHER: 'Altro',
};
