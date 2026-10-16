/** Formatting helpers shared by the map's cards and the event and venue
 * pages. Each one is typed on just the fields it reads, so both EventCardDto
 * and EventDetailDto fit; the address ones take a plain string, so venues
 * fit too. */

/** Window before an event's start in which the "Inizia tra X min" countdown
 * shows instead of the plain start time. */
const STARTING_SOON_MS = 30 * 60 * 1000;

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
 * last fetch and goes stale the moment an event starts.
 *
 * This is all an event's endAt is for: switching "live" off, and dropping the
 * night once it's over. It's never shown — where the real closing time isn't
 * known it's a guess (3 am), and a guess on screen is wrong information. */
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

/** What a live event's badge says: "Live · dalle 22:30" — since when, never
 * until when (see isLiveAt). Null when it isn't live. Shared by the map's
 * cards, the menu's and the event's page. */
export function liveLabel(event: { startAt: string; endAt: string }, now: number): string | null {
  return isLiveAt(event, now) ? `Live · dalle ${formatClock(event.startAt)}` : null;
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

/** hour12: false pinned explicitly rather than relying on it-IT's default
 * 24h clock — Intl's per-locale default can vary by runtime/ICU version, and
 * the app is Italy-only, so it's never meant to show AM/PM. */
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** What an event's entry costs: EventCardDto and EventDetailDto both have it. */
export type Pricing = { free: boolean; price: number | null; currency: string | null };

export function formatPrice(event: Pricing): string {
  if (event.free) return 'Gratis';
  if (event.price == null) return 'Prezzo su invito';
  return `${event.price} ${event.currency ?? ''}`.trim();
}

/** "Bachata Sensual", "Salsa Cubana", "Salsa Portoricana" → Bachata, Salsa:
 * for where every style in full is too long (a link's preview, a post). The
 * event's page lists them all. */
export function styleFamilies(styles: string[]): string[] {
  return [...new Set(styles.map((style) => style.trim().split(/\s+/)[0]))];
}

/** The colour the price is written in: gold, or green for "Gratis". */
export function priceColor(event: Pricing): string {
  return event.free ? 'var(--ev-free)' : 'var(--ev-price)';
}

/** Geocoded addresses already join street+civico with a space ("Via Roma
 * 12"), but older/manually-typed ones use a comma ("Via Roma, 12") — this
 * merges a leading civico into the primary line either way, while a 5-digit
 * CAP in the same position is left for addressSecondary. The country is
 * never part of this line, so it needs no withoutCountry first. */
export function addressPrimary(address: string): string {
  const parts = address.split(',').map((p) => p.trim());
  return parts.length > 1 && isCivico(parts[1]) ? `${parts[0]} ${parts[1]}` : parts[0];
}

/** Everything after the street, the way Italian addresses are written: the
 * CAP in front of its town, by the town's Italian name ("20131, Milan,
 * Lombardy, Italy" → "20131 Milano"). No region and no country (see
 * withoutCountry), no province code after the town ("Milano MI", as typed-in
 * addresses have it). */
export function addressSecondary(address: string): string | null {
  const parts = withoutCountry(address).split(',').map((p) => p.trim());
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
  return lines.length ? italianLocality(lines.join(', ')) : null;
}

/** Every event is in Italy, so a trailing country part — "Italy" as the
 * geocoder writes it (see geocoding.service.ts), or "Italia" typed by hand —
 * says nothing on screen. Display only: googleMapsUrl keeps the full address. */
export function withoutCountry(address: string): string {
  return address.replace(/,\s*(italy|italia)\s*$/i, '');
}

/** Towns the geocoder names in English, by their own name. */
const ITALIAN_TOWNS: Record<string, string> = {
  Milan: 'Milano',
  Rome: 'Roma',
  Turin: 'Torino',
  Naples: 'Napoli',
  Florence: 'Firenze',
  Venice: 'Venezia',
  Genoa: 'Genova',
  Padua: 'Padova',
  Mantua: 'Mantova',
};

/** A whole address on one line, as it's written in Italy: "Via Roma 12,
 * 20092 Cinisello Balsamo" — the street, then addressSecondary. For where
 * there's one line: the Instagram posts, the venue cards. */
export function addressLine(address: string): string {
  return [addressPrimary(address), addressSecondary(address)].filter(Boolean).join(', ');
}

/** Just the town: "Via Achille Grandi 35, 20096, Pioltello, Lombardy, Italy"
 * → "Pioltello", "Viale Europa, 72/C, 20047 Cusago MI" → "Cusago". It says
 * where a place is better than its street does — Milano or out of it, and
 * where — so the lists and the map's cards show it next to the street. */
export function addressTown(address: string): string | null {
  return addressSecondary(address)?.split(',').at(-1)!.trim().replace(/^\d{5}\s*/, '') || null;
}

/** A locality without the province code typed-in addresses end with ("Milano
 * MI", "Bareggio (MI)") and with its town by the Italian name. */
function italianLocality(locality: string): string {
  return locality
    .replace(/\s+\(?[A-Z]{2}\)?$/, '')
    .replace(/\b[A-Z][a-z]+$/, (name) => ITALIAN_TOWNS[name] ?? name);
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
