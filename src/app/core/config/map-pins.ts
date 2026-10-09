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

/** Inner glyph per EventType, drawn in white centred around (12, 12). One
 * path each, so every surface draws it the same way (a single <path>): what
 * the design draws in the pin's colour over the white — the disco ball's
 * seams, the olive — is a gap in the path instead, which shows the pin's body
 * through it, white on a selected (inverted) pin. */
export const PIN_GLYPHS: Record<EventType, string> = {
  // A couple dancing, holding hands, his other arm raised.
  EVENT:
    'M7.6 6.6a1.7 1.7 0 1 1 3.4 0a1.7 1.7 0 1 1-3.4 0zM13.2 6.6a1.7 1.7 0 1 1 3.4 0a1.7 1.7 0 1 1-3.4 0z' +
    'M9.3 8.9 12 15.8H6.6zM13.8 8.9h2.15l1.48-1.87a.6.6 0 0 1 .94.74L16 10.77v5.13h-2.2V11l-3.16.2a.6.6 0 0 1-.08-1.2l3.24-.2z',
  // Graduation cap.
  SCHOOL: 'M12 6.5 5 9.5l7 3 7-3zm-4.5 5.2V15c0 1.1 2 2 4.5 2s4.5-.9 4.5-2v-3.3L12 14z',
  // Disco ball on its string, with a sparkle (a music note passed for a
  // concert). The ball is drawn as its facets: the seams are the gaps.
  CLUB:
    'M11.4 4.6h1.2v2.15h-1.2z' +
    'M13.15 7.33A5 5 0 0 1 16.58 10.2L14.37 10.2A2.55 5.45 0 0 0 13.15 7.33z' +
    'M10.85 7.33A2.55 5.45 0 0 0 9.63 10.2L7.42 10.2A5 5 0 0 1 10.85 7.33zM10.52 10.2A1.65 4.55 0 0 1 13.48 10.2z' +
    'M14.49 11L16.85 11A5 5 0 0 1 16.98 11.8L14.54 11.8A2.55 5.45 0 0 0 14.49 11z' +
    'M7.15 11L9.51 11A2.55 5.45 0 0 0 9.46 11.8L7.02 11.8A5 5 0 0 1 7.15 11z' +
    'M10.41 11L13.59 11A1.65 4.55 0 0 1 13.64 11.8L10.36 11.8A1.65 4.55 0 0 1 10.41 11z' +
    'M14.54 12.6L16.98 12.6A5 5 0 0 1 16.85 13.4L14.49 13.4A2.55 5.45 0 0 0 14.54 12.6z' +
    'M7.02 12.6L9.46 12.6A2.55 5.45 0 0 0 9.51 13.4L7.15 13.4A5 5 0 0 1 7.02 12.6z' +
    'M10.36 12.6L13.64 12.6A1.65 4.55 0 0 1 13.59 13.4L10.41 13.4A1.65 4.55 0 0 1 10.36 12.6z' +
    'M14.37 14.2L16.58 14.2A5 5 0 0 1 13.15 17.07A2.55 5.45 0 0 0 14.37 14.2z' +
    'M7.42 14.2L9.63 14.2A2.55 5.45 0 0 0 10.85 17.07A5 5 0 0 1 7.42 14.2zM10.52 14.2L13.48 14.2A1.65 4.55 0 0 1 10.52 14.2z' +
    'M18.2 5.2l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z',
  // Cocktail glass with an olive (wound the other way: a hole).
  BAR: 'M7 6h10l-4 5.3V15h2v1H9v-1h2v-3.7zM13.5 7.6a1 1 0 1 0 2 0a1 1 0 1 0-2 0z',
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
 * the same paths as PIN_GLYPHS, which fit the badge's 24x24 viewBox too. */
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

/** Italian label per VenueType, for the legend, the venue card and the venue's page. */
export const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  SCHOOL: 'Scuola',
  CLUB: 'Discoteca',
  BAR: 'Bar',
  OTHER: 'Altro',
};

/** /scuole?tipo=tutti: the places list with every type, not just the schools
 * (SchoolList) — the list of the map's "Locali e scuole", and where the
 * menu's "Scuole e locali" leads. */
export const ALL_PLACES_QUERY = { tipo: 'tutti' } as const;
