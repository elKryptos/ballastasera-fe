/** Formatting helpers shared by the map's cards and the event and venue
 * pages. Each one is typed on just the fields it reads, so both EventCardDto
 * and EventDetailDto fit; the address ones take a plain string, so venues
 * fit too. */

/** Window before an event's start in which the "Inizia tra X min" countdown
 * shows instead of the plain start time. */
const STARTING_SOON_MS = 30 * 60 * 1000;

/** Past this, "finisce tra 3 h 20 min" says less than "fino alle 03:00". */
const ENDING_SOON_MINUTES = 90;

/** A civico is 1-4 digits with an optional suffix starting with a slash or a
 * letter (e.g. "12", "12/A", "12bis"); a 5-digit Italian CAP never matches, so
 * it's left for addressSecondary. */
function isCivico(part: string): boolean {
  return /^\d{1,4}(\/[a-zA-Z0-9]{1,3}|[a-zA-Z]{1,3})?$/.test(part);
}

const CAP = /^\d{5}$/;

/** Italian regions as they show up in addresses: in English from the
 * geocoder ("Lombardy") or in Italian when typed by hand ("Lombardia").
 * Every address is in Italy, so next to the city the region says nothing.
 * Lowercase, for matching. */
const ITALIAN_REGIONS = new Set([
  'abruzzo',
  'basilicata',
  'calabria',
  'campania',
  'emilia-romagna',
  'emilia romagna',
  'friuli-venezia giulia',
  'friuli venezia giulia',
  'lazio',
  'liguria',
  'lombardia',
  'lombardy',
  'marche',
  'molise',
  'piemonte',
  'piedmont',
  'puglia',
  'apulia',
  'sardegna',
  'sardinia',
  'sicilia',
  'sicily',
  'toscana',
  'tuscany',
  'trentino-alto adige',
  'trentino-alto adige/südtirol',
  'trentino-south tyrol',
  'umbria',
  "valle d'aosta",
  "valle d'aosta/vallée d'aoste",
  'aosta valley',
  'veneto',
]);

/** Reads the clock rather than event.liveNow, which is a snapshot from the
 * last fetch and goes stale the moment an event starts. */
export function isLiveAt(event: { startAt: string; endAt: string }, now: number): boolean {
  return now >= new Date(event.startAt).getTime() && now <= new Date(event.endAt).getTime();
}

/** Minutes to start, only while inside STARTING_SOON_MS; null once the event
 * is live or too far out to flag. */
function minutesToStart(event: { startAt: string }, now: number): number | null {
  const msToStart = new Date(event.startAt).getTime() - now;
  if (msToStart <= 0 || msToStart > STARTING_SOON_MS) return null;
  return Math.max(1, Math.round(msToStart / 60000));
}

/** Minutes left while live, for "Finisce tra 52 min"; null when not live. */
function minutesToEnd(event: { startAt: string; endAt: string }, now: number): number | null {
  if (!isLiveAt(event, now)) return null;
  return Math.max(1, Math.round((new Date(event.endAt).getTime() - now) / 60000));
}

/** What a live event's badge says: "Live · finisce tra 52 min", or "Live ·
 * fino alle 03:00" while the end is further off than ENDING_SOON_MINUTES.
 * Null when it isn't live. Shared by the map's card, the list and the event's
 * page. */
export function liveLabel(event: { startAt: string; endAt: string }, now: number): string | null {
  const left = minutesToEnd(event, now);
  if (left === null) return null;
  return `Live · ${left <= ENDING_SOON_MINUTES ? `finisce tra ${left} min` : `fino alle ${formatClock(event.endAt)}`}`;
}

/** The badge an event wears right now: live (see liveLabel) or about to
 * start ("Inizia tra 12 min"); null otherwise. The map's card and the
 * event's page. */
export function eventBadge(
  event: { startAt: string; endAt: string },
  now: number,
): { live: boolean; text: string } | null {
  const live = liveLabel(event, now);
  if (live !== null) return { live: true, text: live };
  const minutes = minutesToStart(event, now);
  return minutes === null ? null : { live: false, text: `Inizia tra ${minutes} min` };
}

/** Start-end range rather than just the start time, since these are
 * club/party nights that often run past midnight — knowing when it ends
 * matters as much as when it starts. */
export function formatTimeRange(event: { startAt: string; endAt: string }): string {
  return `${formatClock(event.startAt)} – ${formatClock(event.endAt)}`;
}

/** hour12: false pinned explicitly rather than relying on it-IT's default
 * 24h clock — Intl's per-locale default can vary by runtime/ICU version, and
 * the app is Italy-only, so it's never meant to show AM/PM. */
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatPrice(event: { free: boolean; price: number | null; currency: string | null }): string {
  if (event.free) return 'Gratis';
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

/** Everything after the street, without the region and with the CAP in front
 * of its city ("20131, Milan, Lombardy" → "20131 Milan"), the way Italian
 * addresses are written. */
export function addressSecondary(address: string): string | null {
  const parts = address.split(',').map((p) => p.trim());
  if (parts.length <= 1) return null;
  const rest = (isCivico(parts[1]) ? parts.slice(2) : parts.slice(1)).filter(
    (part) => !ITALIAN_REGIONS.has(part.toLowerCase()),
  );
  const lines: string[] = [];
  for (const part of rest) {
    const previous = lines.at(-1);
    if (previous !== undefined && CAP.test(previous)) {
      lines[lines.length - 1] = `${previous} ${part}`;
    } else {
      lines.push(part);
    }
  }
  return lines.length ? lines.join(', ') : null;
}

/** Every event is in Italy, so a trailing country part — "Italy" as the
 * geocoder writes it (see geocoding.service.ts), or "Italia" typed by hand —
 * says nothing on screen. Display only: googleMapsUrl keeps the full address. */
export function withoutCountry(address: string): string {
  return address.replace(/,\s*(italy|italia)\s*$/i, '');
}

/** Directions to a place — an event's or a venue's. The name, when there is
 * one, helps Google land on the right spot. */
export function googleMapsUrl(address: string, placeName: string | null): string {
  const query = placeName ? `${placeName}, ${address}` : address;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}

/** The bare handle ("zoo_club_disco") from the handle itself, "@handle" or a
 * pasted profile URL ("https://www.instagram.com/zoo_club_disco/?hl=it").
 * Handles are what gets stored; older records may still hold a URL. */
export function instagramHandle(value: string): string {
  return value
    .trim()
    .replace(/^(https?:\/\/)?(www\.|m\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '');
}

/** The profile link for a handle — or for a URL stored by mistake, which
 * would otherwise come out doubled (instagram.com/https://instagram.com/...). */
export function instagramUrl(handleOrUrl: string): string {
  return `https://www.instagram.com/${instagramHandle(handleOrUrl)}/`;
}

/** A WhatsApp chat link. wa.me wants the bare international number: digits
 * only, no "+", spaces or dashes. Null when there's no number to link. */
export function waMeUrl(phone: string | null | undefined): string | null {
  const digits = phone?.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}
