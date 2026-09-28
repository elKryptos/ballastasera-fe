/** Formatting helpers shared by the map's event card and the event detail
 * page. Each one is typed on just the fields it reads, so both EventCardDto
 * and EventDetailDto fit. */

/** Window before an event's start in which the "Inizia tra X min" countdown
 * shows instead of the plain start time. */
const STARTING_SOON_MS = 30 * 60 * 1000;

/** A civico is 1-4 digits with an optional letter/slash suffix (e.g. "12",
 * "12/A"); a 5-digit Italian CAP never matches, so it's left for addressSecondary. */
function isCivico(part: string): boolean {
  return /^\d{1,4}(\/?[a-zA-Z0-9]{0,3})?$/.test(part);
}

/** Reads the clock rather than event.liveNow, which is a snapshot from the
 * last fetch and goes stale the moment an event starts. */
export function isLiveAt(event: { startAt: string; endAt: string }, now: number): boolean {
  return now >= new Date(event.startAt).getTime() && now <= new Date(event.endAt).getTime();
}

/** Minutes to start, only while inside STARTING_SOON_MS; null once the event
 * is live or too far out to flag. */
export function minutesToStart(event: { startAt: string }, now: number): number | null {
  const msToStart = new Date(event.startAt).getTime() - now;
  if (msToStart <= 0 || msToStart > STARTING_SOON_MS) return null;
  return Math.max(1, Math.round(msToStart / 60000));
}

export function formatPrice(event: { isFree: boolean; price: number | null; currency: string | null }): string {
  if (event.isFree) return 'Gratis';
  if (event.price == null) return 'Prezzo su invito';
  return `${event.price} ${event.currency ?? ''}`.trim();
}

/** Geocoded addresses already join street+civico with a space ("Via Roma
 * 12"), but older/manually-typed ones use a comma ("Via Roma, 12") — this
 * merges a leading civico into the primary line either way, while a 5-digit
 * CAP in the same position is left for addressSecondary. */
export function addressPrimary(address: string): string {
  const parts = address.split(',').map((p) => p.trim());
  return parts.length > 1 && isCivico(parts[1]) ? `${parts[0]} ${parts[1]}` : parts[0];
}

export function addressSecondary(address: string): string | null {
  const parts = address.split(',').map((p) => p.trim());
  if (parts.length <= 1) return null;
  const rest = isCivico(parts[1]) ? parts.slice(2) : parts.slice(1);
  return rest.length ? rest.join(', ') : null;
}

export function googleMapsUrl(event: { venueName: string | null; address: string }): string {
  const query = event.venueName ? `${event.venueName}, ${event.address}` : event.address;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}

export function instagramUrl(handle: string): string {
  return `https://www.instagram.com/${handle}/`;
}
