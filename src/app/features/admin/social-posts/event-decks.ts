import { EventCardDto, EventDetailDto } from '../../../core/models/event.model';
import { DateRange, capitalize, eventNight, nightDate, nightOf } from '../../../core/utils/event-filters';
import {
  addressLine,
  addressTown,
  formatClock,
  formatPrice,
  instagramHandle,
  styleFamilies,
} from '../../../core/utils/event-format';
import { Card, MAX_ROWS, NightRow } from './cards';
import { CardNote, Deck, Kind } from './deck';

/** What's published from the events, each as a post, a story or a reel
 * (Kind): the nights of a period (nightsDeck) and one night on its own
 * (eventDeck). `events` are already the period's (inDateRange), soonest
 * first. */

/** The periods the nights are published for; DateRange's 'all' and
 * 'halloween' are none. */
export type Period = Exclude<DateRange, 'all' | 'halloween'>;

/** `when` is how the period reads in a sentence; `alone`, the heading of a
 * story about that single night. */
export const PERIODS: { value: Period; label: string; when: string; alone?: string }[] = [
  { value: 'tonight', label: 'Stasera', when: 'stasera', alone: 'Stasera si balla' },
  { value: 'tomorrow', label: 'Domani', when: 'domani', alone: 'Domani si balla' },
  { value: 'weekend', label: 'Weekend', when: 'questo weekend' },
  { value: 'week', label: 'Settimana', when: 'questa settimana' },
];

const SITE = 'ballastasera.it';
/** Where a story about several nights sends: the list. */
const LIST_LINK = `https://${SITE}/lista`;

interface Night {
  night: number;
  events: EventCardDto[];
}

/** The events by night, earliest first, each night in the order they came. */
function byNight(events: EventCardDto[], now: number): Night[] {
  const nights = new Map<number, EventCardDto[]>();
  for (const event of events) {
    const night = eventNight(event, now);
    const sameNight = nights.get(night);
    if (sameNight) sameNight.push(event);
    else nights.set(night, [event]);
  }
  return Array.from(nights, ([night, sameNight]) => ({ night, events: sameNight })).sort((a, b) => a.night - b.night);
}

/** The night an event starts on: what its own card and its label go by,
 * where a period puts one already underway under tonight (eventNight). */
const startNight = (event: EventCardDto): number => nightOf(Date.parse(event.startAt));

/** The venue, or the organizer where there's none. */
const placeOf = (event: EventCardDto): string => event.venueName ?? event.organizerName ?? '';

/** "#salsamilano": the city in the hashtags that close a text about its nights. */
function hashtags(city: string): string {
  const tag = city.toLowerCase().replace(/[^a-zà-ú]/g, '');
  return `#salsa #bachata #salsa${tag} #bachata${tag} #seratelatine #ballilatini #${tag}`;
}

/** A card with what goes with it when it's published on its own. */
interface Picture extends CardNote {
  card: Card;
}

const plain = (card: Card): Picture => ({ card, mentions: '', link: null });

/** The pictures as a deck. What goes with each depends on the kind: on a
 * post, who to tag on it; on a story, the link too; on a reel nothing — it's
 * one video, and its text carries the mentions. */
function toDeck(kind: Kind, slug: string, pictures: Picture[], words: Pick<Deck, 'text' | 'textLabel' | 'textHint'>): Deck {
  return {
    slug: `${kind}-${slug}`,
    kind,
    cards: pictures.map((picture) => picture.card),
    notes: pictures.map(({ mentions, link }) => ({
      mentions: kind === 'reel' ? '' : mentions,
      link: kind === 'story' ? link : null,
    })),
    ...words,
  };
}

/** A night's events on cards of at most MAX_ROWS, split evenly (8 nights are
 * 4 and 4, not 5 and 3), each with the events on it. `sub` gets "· 1/2" when
 * there's more than one. */
function nightCards(events: EventCardDto[], heading: string, sub: string): { card: Card; events: EventCardDto[] }[] {
  const parts = Math.ceil(events.length / MAX_ROWS);
  const perCard = Math.ceil(events.length / parts);
  return Array.from({ length: parts }, (_, part) => {
    const shown = events.slice(part * perCard, (part + 1) * perCard);
    return {
      events: shown,
      card: { kind: 'night', heading, sub: parts > 1 ? `${sub} · ${part + 1}/${parts}` : sub, rows: shown.map(toRow) },
    };
  });
}

function toRow(event: EventCardDto): NightRow {
  return {
    time: formatClock(event.startAt),
    title: event.title,
    place: placeOf(event),
    where: [addressTown(event.address), styleFamilies(event.danceStyles).join(', ')].filter(Boolean).join(' · '),
    price: formatPrice(event),
    free: event.free,
    flyerUrl: event.flyerUrl,
  };
}

/** One night's own card: the flyer large, the date beside it, then what,
 * where, what's danced and the price. The address is the event's own, with
 * its CAP and its town: around a city most venues are in the towns next to
 * it, not in the city the search is for. */
function eventCard(event: EventCardDto): Card {
  const [weekday, day, month] = nightDate(startNight(event), 'long').split(' ');
  return {
    kind: 'event',
    weekday,
    day,
    month,
    time: formatClock(event.startAt),
    price: formatPrice(event),
    free: event.free,
    title: event.title,
    place: placeOf(event),
    address: addressLine(event.address),
    styles: styleFamilies(event.danceStyles),
    flyerUrl: event.flyerUrl,
  };
}

/** The flyers of `events`, each once, in their order. */
function flyerUrls(events: EventCardDto[]): string[] {
  return [...new Set(events.map((event) => event.flyerUrl).filter((url): url is string => !!url))];
}

/** That card with its venue's profiles and the night's page. */
function eventPicture(event: EventCardDto, mentionsOf: Mentions): Picture {
  return { card: eventCard(event), mentions: mentionsOf(event).join(' '), link: `https://${SITE}/evento/${event.id}` };
}

/** The card that closes a carousel or a reel about the nights: their
 * flyers, a mosaic over its top, when there are enough of them not to show
 * the same few over and over. */
function outro(city: string, flyers: string[]): Card {
  return {
    kind: 'outro',
    title: 'Tutte le serate,',
    flair: 'ogni giorno.',
    note: `Mappa, lista e scuole di salsa e bachata a ${city}`,
    flyers: flyers.length >= MOSAIC_MIN ? flyers.slice(0, MOSAIC_MAX) : [],
  };
}

/** A mosaic's tiles: fewer flyers than MOSAIC_MIN and there's none; past
 * MOSAIC_MAX it repeats them. */
const MOSAIC_MIN = 4;
const MOSAIC_MAX = 12;
/** The flyers fanned out on a cover. */
const FAN_FLYERS = 3;
/** Up to this many nights a carousel shows each on its own card, not a
 * night's list first: one or two rows left the list mostly bare, and the
 * cards after it said it all again. */
const FEW_EVENTS = 2;

/** An event's Instagram profiles as mentions ("@zoo_club_disco"): what
 * makes a post reach the people it's about, who can then share it again. */
export type Mentions = (event: EventCardDto) => string[];

/** What Instagram accepts as a username: anything else pasted after an "@"
 * would read as a mention and tag nobody. */
const USERNAME = /^[a-z0-9._]{1,30}$/i;

/** The profiles as they're saved, handle or pasted URL, as mentions: each
 * once, and only the ones that can be a username. Never made up from a name. */
function mentions(saved: (string | null | undefined)[]): string[] {
  const names = saved.map((value) => instagramHandle(value ?? '').toLowerCase()).filter((name) => USERNAME.test(name));
  return [...new Set(names)].map((name) => `@${name}`);
}

/** From the event's full record: its venue's profile, its own and its
 * organizer's. The map's card only carries the organizer's (cardMentions),
 * which many nights held at a venue don't have. */
export function detailMentions(event: EventDetailDto): string[] {
  return mentions([event.venue?.instagram, event.instagramUrl, event.organizer?.instagram]);
}

/** All there is until the full record is in. */
export function cardMentions(event: EventCardDto): string[] {
  return mentions([event.organizerInstagram]);
}

const VIDEO_HINT =
  'Il video è muto: quando lo pubblichi aggiungi una canzone dalla musica di Instagram. Gli @ nel testo diventano menzioni da soli.';
const STORY_HINT =
  'Sotto ogni immagine trovi chi menzionare in quella story (adesivo "Menzione") e il link per l’adesivo "Link": è la menzione che permette al locale di ricondividerla con un tocco. Qui, tutti i profili insieme.';

/**
 * The nights of a period. As a post it's a carousel: a cover, each night's
 * events, and a card that sends to the site. As a story it's the nights
 * alone, one a story (a single night's says "Stasera si balla"). As a reel,
 * the carousel's cards at a story's size, to be played one after the other.
 * `detailed` adds, after the nights, a card of its own for every event
 * (eventCard): the overview first, then each venue's night in full — the
 * one its venue shares. With FEW_EVENTS or less those cards are all there
 * is, without the nights' lists. Null with no events.
 */
export function nightsDeck(
  events: EventCardDto[],
  period: Period,
  city: string,
  now: number,
  mentionsOf: Mentions,
  kind: Kind,
  detailed: boolean,
): Deck | null {
  const nights = byNight(events, now);
  if (!nights.length) return null;
  const { when, alone } = PERIODS.find((option) => option.value === period)!;
  const first = nights[0].night;
  const last = nights[nights.length - 1].night;
  const count = `${events.length} ${events.length === 1 ? 'serata' : 'serate'}`;
  const together = (shown: EventCardDto[]): string => [...new Set(shown.flatMap(mentionsOf))].join(' ');

  const few = events.length <= FEW_EVENTS;
  const flyers = flyerUrls(events);
  const fanned = flyers.slice(0, FAN_FLYERS);
  const pictures: Picture[] = [];
  const lines = [`Dove si balla ${when} a ${city}? 💃🕺`];
  if (kind !== 'story') {
    pictures.push(
      plain({
        kind: 'cover',
        kicker: null,
        title: 'Dove si balla',
        flair: `${when}?`,
        sub: `Salsa e bachata a ${city}`,
        accent: first === last ? nightDate(first, 'long') : `${nightDate(first, 'short')} – ${nightDate(last, 'short')}`,
        note: kind === 'post' ? `${count} · scorri →` : count,
        flyers: fanned,
        more: events.length > fanned.length ? `+${events.length - fanned.length} serate` : null,
      }),
    );
  }
  for (const { night, events: sameNight } of nights) {
    const date = nightDate(night, 'long');
    const [weekday, ...rest] = date.split(' ');
    const [heading, sub] =
      kind === 'story' && alone ? [alone, `${capitalize(date)} · ${city}`] : [capitalize(weekday), rest.join(' ')];
    if (!few) {
      for (const { card, events: shown } of nightCards(sameNight, heading, sub)) {
        pictures.push({ card, mentions: together(shown), link: LIST_LINK });
      }
    }
    lines.push('', date.toUpperCase());
    for (const event of sameNight) {
      // The mentions close the line: nothing after a username that Instagram
      // could take for part of it.
      const what = [event.title, event.venueName].filter(Boolean).join(', ');
      lines.push([`• ${formatClock(event.startAt)} — ${what}`, ...mentionsOf(event)].join(' '));
    }
  }
  if (detailed || few) pictures.push(...events.map((event) => eventPicture(event, mentionsOf)));
  if (kind !== 'story') pictures.push(plain(outro(city, flyers)));
  lines.push('', `Tutte le serate, giorno per giorno, su ${SITE} (link in bio).`, '', hashtags(city));

  const slug = `serate-${period}${detailed ? '-dettagli' : ''}`;
  if (kind === 'story') {
    return toDeck(kind, slug, pictures, {
      textLabel: 'Tutti i profili e il link',
      textHint: STORY_HINT,
      text: [together(events), LIST_LINK].filter(Boolean).join('\n'),
    });
  }
  return toDeck(kind, slug, pictures, {
    textLabel: kind === 'reel' ? 'Testo del reel' : 'Testo del post',
    textHint:
      kind === 'reel'
        ? VIDEO_HINT
        : 'Ogni @ è il profilo salvato per quel locale o organizzatore: incollato nel testo diventa una menzione da solo. Sotto ogni immagine, chi taggare su quella ("Tagga persone").',
    text: lines.join('\n'),
  });
}

/** In the picker of the nights: "ven 16 ott · 22:00 · Vibra Latina — Zoo Club". */
export function eventLabel(event: EventCardDto): string {
  const when = `${nightDate(startNight(event), 'short')} · ${formatClock(event.startAt)}`;
  return `${when} · ${[event.title, event.venueName].filter(Boolean).join(' — ')}`;
}

/** One night on its own: the picture a venue shares without its neighbours
 * on it. A post or a story is that one card; a reel opens on the night's
 * name and closes on the site, so there's something to play. */
export function eventDeck(event: EventCardDto, kind: Kind, city: string, mentionsOf: Mentions): Deck {
  const date = capitalize(nightDate(startNight(event), 'long'));
  const time = formatClock(event.startAt);
  const price = formatPrice(event);
  const address = addressLine(event.address);
  const picture = eventPicture(event, mentionsOf);
  const slug = `serata-${event.slug || event.id}`;

  if (kind === 'story') {
    return toDeck(kind, slug, [picture], {
      textLabel: 'Profili e link',
      textHint: STORY_HINT,
      text: [picture.mentions, picture.link].filter(Boolean).join('\n'),
    });
  }
  const pictures =
    kind === 'post'
      ? [picture]
      : [
          plain({
            kind: 'cover',
            kicker: date,
            title: event.title,
            flair: placeOf(event) || city,
            sub: address,
            accent: `Dalle ${time} · ${price}`,
            note: 'Tutti i dettagli →',
            flyers: flyerUrls([event]),
          }),
          picture,
          plain(outro(city, [])),
        ];
  return toDeck(kind, slug, pictures, {
    textLabel: kind === 'reel' ? 'Testo del reel' : 'Testo del post',
    textHint:
      kind === 'reel'
        ? VIDEO_HINT
        : 'Gli @ in fondo sono i profili salvati del locale e dell’organizzatore: incollati nel testo diventano menzioni da soli.',
    text: [
      `${event.title} 💃🕺`,
      '',
      `📅 ${date}, dalle ${time}`,
      `📍 ${[event.venueName, address].filter(Boolean).join(', ')}`,
      ...(event.danceStyles.length ? [`🎵 ${event.danceStyles.join(', ')}`] : []),
      `🎟 ${price}`,
      ...(picture.mentions ? ['', picture.mentions] : []),
      '',
      `Questa e tutte le altre serate su ${SITE} (link in bio).`,
      '',
      hashtags(city),
    ].join('\n'),
  });
}
