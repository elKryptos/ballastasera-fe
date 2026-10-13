import { endpoints } from './app/core/api/endpoints';
import { CityDto } from './app/core/models/city.model';
import { MapEventsDto } from './app/core/models/event.model';
import { VenuesSummaryDto } from './app/core/models/venue.model';
import { cityBounds } from './app/core/utils/geo';
import { environment } from './environments/environment';

/** The pages that are always there. Each has its own title, description and
 * canonical URL (PAGE_SEO; the home's are in index.html). */
const FIXED_PAGES = ['/', '/lista', '/mappa', '/impara-a-ballare', '/playlist', '/scuole'];

/** The API answers in well under a second; past this the sitemap goes out
 * with the fixed pages alone rather than keep a crawler waiting. */
const API_TIMEOUT_MS = 8000;

/**
 * /sitemap.xml, written on request (server.ts) rather than kept as a file:
 * the fixed pages, then every venue and every live or upcoming event of every
 * city, straight from the API — the same requests /scuole and /lista make.
 * If the API can't be reached it's the fixed pages alone, and not cached, so
 * the next request tries again.
 */
export async function sitemapResponse(origin: string): Promise<Response> {
  let paths = FIXED_PAGES;
  let complete = true;
  try {
    paths = [...FIXED_PAGES, ...(await dataPages())];
  } catch {
    complete = false;
  }
  const urls = paths.map((path) => `  <url><loc>${origin}${path}</loc></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': complete ? 'public, max-age=3600' : 'no-store',
    },
  });
}

/** /luogo/:id and /evento/:id for every city. Ids are UUIDs: nothing to escape. */
async function dataPages(): Promise<string[]> {
  const cities = await api<CityDto[]>(endpoints.cities.list);
  const perCity = await Promise.all(
    cities.map(async (city) => {
      const bounds = cityBounds(city);
      const box = `minLat=${bounds.minLat}&maxLat=${bounds.maxLat}&minLng=${bounds.minLng}&maxLng=${bounds.maxLng}`;
      const [venues, { events }] = await Promise.all([
        api<VenuesSummaryDto[]>(`${endpoints.venues.list}?cityId=${city.id}`),
        api<MapEventsDto>(`${endpoints.events.mapEvents}?${box}&cityId=${city.id}`),
      ]);
      return [...venues.map((venue) => `/luogo/${venue.id}`), ...events.map((event) => `/evento/${event.id}`)];
    }),
  );
  return perCity.flat();
}

async function api<T>(path: string): Promise<T> {
  const response = await fetch(`${environment.apiUrl}${path}`, { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return (await response.json()) as T;
}
