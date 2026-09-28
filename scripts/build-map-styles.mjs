// Builds the /mappa MapLibre basemap styles in public/map-styles/, from
// OpenFreeMap's Liberty style (free, no API key, no request limits, commercial
// use allowed — https://openfreemap.org): one per theme, same layers, two
// palettes.
//
// - light.json: modelled on CARTO Voyager (the light basemap this replaced):
//   warm paper land, white streets, pale-yellow arterials, orange-yellow
//   motorways, soft green parks, light-blue water, blue-grey labels.
// - dark.json: a Google-Maps "night"-like recolour: slate-blue land, roads
//   *lighter* than the land (like Google's dark mode, unlike an inverted light
//   map), muted amber motorways, night-blue water, light labels.
//
// Liberty's layers, widths, labels and shields are kept; only the colours
// change. Buildings stay flat (no 3D extrusion), and Liberty's business POIs
// (shops, ATMs, offices…) are dropped — the map is about our event pins — and
// replaced by metro and train stations only.
//
// Re-run when OpenFreeMap updates Liberty or to tweak a palette:
//   pnpm map:styles
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/map-styles');

/** Road colours per class: surface / tunnel / casing / bridge casing. Casings
 * frame the fill (darker on dark, a shade deeper on light) so roads keep an
 * edge; tunnels are a step fainter, as they read "under" the map. */
const road = (surface, tunnel, casing, bridgeCasing) => ({ surface, tunnel, casing, bridgeCasing });

const DARK = {
  land: '#1d2230',
  halo: 'rgba(29, 34, 48, 0.9)',
  residential: 'rgba(38, 44, 62, 0.5)',
  park: '#1c332f',
  parkOutline: '#223a35',
  wood: '#1b302c',
  grass: '#1d322f',
  ice: '#2a3242',
  pitch: '#1e3530',
  cemetery: '#1e2f2b',
  hospital: '#2b2233',
  school: '#262a3b',
  sand: '#2b2a26',
  water: '#0e1a2c',
  waterway: '#13243a',
  aeroway: '#232839',
  runway: '#2f3547',
  pedestrianArea: '#262c3a',
  building: '#252b3a',
  buildingOutline: '#2c3345',
  boundaryMinor: '#434a5e',
  boundaryMajor: '#5a6178',
  waterLabel: '#6d8cb5',
  waterLabelHalo: 'rgba(14, 26, 44, 0.8)',
  poiLabel: '#9ba2b3',
  transitLabel: '#7ea6d8',
  roadLabel: '#8e96a8',
  pathLabel: '#7a8294',
  placeMinor: '#9aa1b3',
  placeTown: '#c4c9d4',
  placeCity: '#e6e8ee',
  placeState: '#8e96a8',
  placeCountry: '#b9bfcc',
  roads: {
    motorway_link: road('#5d523f', '#473f34', '#2a261f', '#221f1a'),
    motorway: road('#6b5d48', '#50473a', '#2a261f', '#221f1a'),
    trunk_primary: road('#4b5569', '#3a4253', '#151923', '#10131b'),
    secondary_tertiary: road('#3e475a', '#323a4b', '#151923', '#10131b'),
    link: road('#3e475a', '#323a4b', '#151923', '#10131b'),
    minor: road('#333b4d', '#2a3140', '#151923', '#10131b'),
    street: road('#333b4d', '#2a3140', '#151923', '#10131b'),
    service_track: road('#2c3343', '#262c3a', '#151923', '#10131b'),
    path_pedestrian: road('#2c3343', '#262c3a', '#151923', '#10131b'),
    major_rail: road('#3c4353', '#30364a', '#151923', '#10131b'),
    transit_rail: road('#3c4353', '#30364a', '#151923', '#10131b'),
  },
};

// Colours sampled from Voyager's own tiles over Milano.
const LIGHT = {
  land: '#fbf8f3',
  halo: 'rgba(251, 248, 243, 0.9)',
  residential: 'rgba(244, 236, 223, 0.45)',
  park: '#d3e6c1',
  parkOutline: '#c6ddb1',
  wood: '#cde2b8',
  grass: '#d9e9c9',
  ice: '#f2f5f8',
  pitch: '#d9e9c9',
  cemetery: '#e5ecd5',
  hospital: '#f9ebe8',
  school: '#f6efdc',
  sand: '#f7efd9',
  water: '#cce7ea',
  waterway: '#b7dce1',
  aeroway: '#f0ebe3',
  runway: '#e6e4df',
  pedestrianArea: '#f6f1ea',
  // Barely off the land, like Voyager's: buildings as texture, not a surface.
  building: '#f6f0e6',
  buildingOutline: '#ebe2d4',
  boundaryMinor: '#c9c2b8',
  boundaryMajor: '#a39e97',
  waterLabel: '#5b8fa6',
  waterLabelHalo: 'rgba(204, 231, 234, 0.8)',
  poiLabel: '#6b6258',
  transitLabel: '#2e5a80',
  roadLabel: '#6f6a64',
  pathLabel: '#8a847d',
  placeMinor: '#6b7a8c',
  placeTown: '#405c78',
  placeCity: '#2f455c',
  placeState: '#6b7a8c',
  placeCountry: '#405c78',
  roads: {
    // Only the big roads are yellow, as on Voyager; secondary ones stay white.
    motorway_link: road('#fde2ae', '#feefd0', '#e8b96a', '#d9a653'),
    motorway: road('#fbdb98', '#fde9c2', '#e8b96a', '#d9a653'),
    trunk_primary: road('#feedbf', '#fff5d9', '#ead59a', '#dcc27a'),
    secondary_tertiary: road('#fffef6', '#fbf9f3', '#e9e0d0', '#dbd1c0'),
    link: road('#fffef6', '#fbf9f3', '#e9e0d0', '#dbd1c0'),
    minor: road('#ffffff', '#f7f4ef', '#e6ddd0', '#d8cebf'),
    street: road('#ffffff', '#f7f4ef', '#e6ddd0', '#d8cebf'),
    service_track: road('#ffffff', '#f7f4ef', '#ebe3d7', '#ddd3c5'),
    path_pedestrian: road('#ffffff', '#f7f4ef', '#ebe3d7', '#ddd3c5'),
    major_rail: road('#d3cdc5', '#e2ddd6', '#fbf8f3', '#e4dbd0'),
    transit_rail: road('#d3cdc5', '#e2ddd6', '#fbf8f3', '#e4dbd0'),
  },
};

/** Paint overrides for one layer, by id, in palette `P`. Returns null to leave it alone. */
function recolor(layer, P) {
  const id = layer.id;
  const text = (color, halo = P.halo) => ({ 'text-color': color, 'text-halo-color': halo });

  // Greens drawn opaque: Liberty fades them (0.3–0.7) to tame its saturated
  // colours, which would wash our already-soft palette out to near nothing
  // (Parco Sempione came out white on the light map).
  if (id === 'background') return { 'background-color': P.land };
  if (id === 'park') return { 'fill-color': P.park, 'fill-outline-color': P.parkOutline, 'fill-opacity': 1 };
  if (id === 'park_outline') return { 'line-color': P.parkOutline };
  if (id === 'landuse_residential') return { 'fill-color': P.residential };
  if (id === 'landcover_wood') return { 'fill-color': P.wood, 'fill-opacity': 1 };
  if (id === 'landcover_grass') return { 'fill-color': P.grass, 'fill-opacity': 1 };
  if (id === 'landcover_ice') return { 'fill-color': P.ice };
  if (id === 'landcover_sand') return { 'fill-color': P.sand };
  if (id === 'landuse_pitch' || id === 'landuse_track') return { 'fill-color': P.pitch };
  if (id === 'landuse_cemetery') return { 'fill-color': P.cemetery };
  if (id === 'landuse_hospital') return { 'fill-color': P.hospital };
  if (id === 'landuse_school') return { 'fill-color': P.school };
  if (id === 'water') return { 'fill-color': P.water };
  if (id.startsWith('waterway_') && layer.type === 'line') return { 'line-color': P.waterway };
  if (id === 'aeroway_fill') return { 'fill-color': P.aeroway };
  if (id === 'aeroway_runway' || id === 'aeroway_taxiway') return { 'line-color': P.runway };
  if (id === 'road_area_pattern') return { 'fill-color': P.pedestrianArea };
  if (id === 'building') return { 'fill-color': P.building, 'fill-outline-color': P.buildingOutline };
  if (id === 'boundary_3') return { 'line-color': P.boundaryMinor };
  if (id === 'boundary_2' || id === 'boundary_disputed') return { 'line-color': P.boundaryMajor };

  if (id === 'waterway_line_label' || id.startsWith('water_name_')) return text(P.waterLabel, P.waterLabelHalo);
  if (id.startsWith('transit_')) return text(P.transitLabel);
  if (id === 'airport') return text(P.poiLabel);
  if (id === 'highway-name-path') return text(P.pathLabel);
  if (id.startsWith('highway-name-')) return { ...text(P.roadLabel), 'text-halo-width': 1 };
  if (id === 'label_other') return text(P.placeMinor);
  if (id === 'label_village' || id === 'label_town') return text(P.placeTown);
  if (id === 'label_city' || id === 'label_city_capital') return text(P.placeCity);
  if (id === 'label_state') return text(P.placeState);
  if (id.startsWith('label_country_')) return text(P.placeCountry);

  if (layer.type === 'line' && /^(road|tunnel|bridge)_/.test(id)) {
    // Longest class names first, so "motorway_link" wins over "motorway" and "link".
    const cls = Object.keys(P.roads)
      .sort((a, b) => b.length - a.length)
      .find((c) => id.includes(c));
    if (!cls) return null;
    const colors = P.roads[cls];
    if (id.endsWith('_casing')) return { 'line-color': id.startsWith('bridge_') ? colors.bridgeCasing : colors.casing };
    return { 'line-color': id.startsWith('tunnel_') ? colors.tunnel : colors.surface };
  }
  return null;
}

// Liberty labels in English (name_en, e.g. "Milan"); this app is Italian, so
// prefer the Italian name and fall back to the local one ("Milano").
const localizeName = (expr) =>
  Array.isArray(expr)
    ? JSON.stringify(expr) === '["get","name_en"]'
      ? ['get', 'name:it']
      : expr.map(localizeName)
    : expr;

// Liberty compares numeric fields that many features don't have (e.g. the
// shields' `ref_length` on every named street, only numbered roads carry
// one); with expression filters a missing value throws "Expected value to be
// of type number, but found null" in the console for each such feature.
// Checking `has` first short-circuits the comparison for those.
const NUMERIC_OPS = new Set(['<', '<=', '>', '>=']);
const guardNumeric = (expr) => {
  if (!Array.isArray(expr)) return expr;
  const mapped = expr.map(guardNumeric);
  const [op, operand] = mapped;
  if (NUMERIC_OPS.has(op) && mapped.length === 3 && Array.isArray(operand) && operand[0] === 'get') {
    return ['all', ['has', operand[1]], mapped];
  }
  return mapped;
};

const res = await fetch(SOURCE_STYLE);
if (!res.ok) throw new Error(`${SOURCE_STYLE}: ${res.status}`);
const base = await res.json();

// Natural Earth shaded relief: a low-zoom raster that fits neither palette
// (it would glow on the dark land), so drop it and its source.
base.layers = base.layers.filter((layer) => layer.source !== 'ne2_shaded');
delete base.sources.ne2_shaded;

// Short attribution, overriding the long one in OpenFreeMap's TileJSON
// ("OpenFreeMap © OpenMapTiles Data from OpenStreetMap"; the OpenFreeMap
// part is optional per their terms). "© OpenStreetMap" isn't repeated here:
// map.ts credits it once on the attribution control.
base.sources.openmaptiles.attribution =
  '© <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a>';

// Flat buildings only: Liberty hands buildings over from a flat fill to a 3D
// extrusion at z14; keep the flat one at every zoom instead, so the map stays
// a plain backdrop for the event pins.
base.layers = base.layers.filter((layer) => layer.type !== 'fill-extrusion');
delete base.layers.find((layer) => layer.id === 'building').maxzoom;

// US interstate/highway shields never match in Italy, but MapLibre would still
// run their filters on every road of every tile; the generic shield layer
// (highway-shield-non-us: A4, SS11…) stays.
base.layers = base.layers.filter((layer) => !['highway-shield-us-interstate', 'road_shield_us'].includes(layer.id));

// Pedestrian areas use a hatch pattern image; a flat fill (recolor()) reads
// better in both palettes.
delete base.layers.find((layer) => layer.id === 'road_area_pattern').paint['fill-pattern'];

// Metro and train stations instead of Liberty's POIs: landmarks to place an
// event by ("next to Porta Venezia"), few enough not to compete with the
// event pins. Bus and tram stops are left out on purpose — hundreds of them,
// no help in choosing an event, and getting there is the detail page's
// "Indicazioni" (Google Maps directions). Liberty's own transit layer filters
// on a "rail" class the tiles don't use (stations are class "railway",
// subclass subway/station), and its shop/office/ATM layers ask for icons the
// OpenFreeMap sprite doesn't have.
const libertyTransit = base.layers.find((layer) => layer.id === 'poi_transit');
const stations = {
  id: 'transit_stations',
  type: 'symbol',
  source: 'openmaptiles',
  'source-layer': 'poi',
  minzoom: 13,
  filter: [
    'all',
    ['==', ['get', 'class'], 'railway'],
    ['match', ['get', 'subclass'], ['subway', 'station', 'halt'], true, false],
  ],
  layout: {
    ...libertyTransit.layout,
    'icon-image': ['match', ['get', 'subclass'], 'subway', 'railway_metro', 'railway'],
    // Interchanges come as one point per line (Duomo M1 and M3, a few metres
    // apart): the wider collision padding lets only one of them through, so
    // the name isn't printed twice.
    'icon-padding': 12,
    'text-padding': 12,
  },
  paint: { ...libertyTransit.paint },
};
// On top of the whole stack, not where Liberty's POIs were: MapLibre places
// the topmost layer's symbols first, so stations win label collisions. Left
// under the street and place names, they got crowded out as those multiply
// with zoom (from z16 up, Cordusio vanished next to Via Orefici's label).
base.layers = base.layers.filter((layer) => layer['source-layer'] !== 'poi');
base.layers.push(stations);

for (const layer of base.layers) {
  if (layer.filter) layer.filter = guardNumeric(layer.filter);
  if (layer.layout?.['text-field']) layer.layout['text-field'] = localizeName(layer.layout['text-field']);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [file, name, palette] of [
  ['light.json', 'ballastasera light (OpenFreeMap Liberty, Voyager-like)', LIGHT],
  ['dark.json', 'ballastasera dark (OpenFreeMap Liberty, Google-night-like)', DARK],
]) {
  const style = structuredClone(base);
  style.name = name;
  const untouched = [];
  for (const layer of style.layers) {
    const overrides = recolor(layer, palette);
    if (overrides) Object.assign((layer.paint ??= {}), overrides);
    else if (Object.keys(layer.paint ?? {}).some((k) => k.endsWith('color'))) untouched.push(layer.id);
  }
  if (untouched.length) throw new Error(`${file}: layers with colours but no palette rule: ${untouched.join(', ')}`);

  const out = resolve(OUT_DIR, file);
  // Minified: generated output, downloaded on every /mappa visit; this
  // script is what gets read and edited.
  const text = JSON.stringify(style) + '\n';
  writeFileSync(out, text);
  console.log(`wrote ${out} (${style.layers.length} layers, ${(text.length / 1024).toFixed(0)} KB)`);
}
