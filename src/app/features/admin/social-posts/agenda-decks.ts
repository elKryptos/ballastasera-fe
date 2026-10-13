import { EventCardDto, EventDetailDto } from '../../../core/models/event.model';
import { DateRange, capitalize, eventNight, nightDate, nightOf } from '../../../core/utils/event-filters';
import { addressLine, formatClock, formatPrice, instagramHandle } from '../../../core/utils/event-format';
import { Card, Format, MAX_ROWS, NightRow } from './cards';
import { Deck } from './deck';

/** The posts made from the events: the agenda (a carousel, a night per card),
 * tonight's story, and one night on its own. `events` are already the
 * range's (inDateRange), soonest first. */

/** The ranges an agenda is made for; DateRange's 'all' is no agenda. */
export type AgendaRange = Exclude<DateRange, 'all'>;

export const AGENDA_RANGES: { value: AgendaRange; label: string; when: string }[] = [
  { value: 'weekend', label: 'Weekend', when: 'questo weekend' },
  { value: 'week', label: 'Settimana', when: 'questa settimana' },
  { value: 'tonight', label: 'Stasera', when: 'stasera' },
  { value: 'tomorrow', label: 'Domani', when: 'domani' },
];

/** A story is about one night. */
export type StoryDay = 'tonight' | 'tomorrow';

export const STORY_DAYS: { value: StoryDay; label: string; heading: string }[] = [
  { value: 'tonight', label: 'Stasera', heading: 'Stasera si balla' },
  { value: 'tomorrow', label: 'Domani', heading: 'Domani si balla' },
];

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
 * where the agenda puts one already underway under tonight (eventNight). */
const startNight = (event: EventCardDto): number => nightOf(Date.parse(event.startAt));

/** The venue, or the organizer where there's none. */
const placeOf = (event: EventCardDto): string => event.venueName ?? event.organizerName ?? '';

/** "#salsamilano": the city in the hashtags that close a post about its nights. */
function hashtags(city: string): string {
  const tag = city.toLowerCase().replace(/[^a-zà-ú]/g, '');
  return `#salsa #bachata #salsa${tag} #bachata${tag} #seratelatine #ballilatini #${tag}`;
}

/** A night's events as cards of at most MAX_ROWS, split evenly (8 nights
 * are 4 and 4, not 5 and 3). `sub` gets "· 1/2" when there's more than one. */
function nightCards(events: EventCardDto[], heading: string, sub: string): Card[] {
  const parts = Math.ceil(events.length / MAX_ROWS);
  const perCard = Math.ceil(events.length / parts);
  return Array.from({ length: parts }, (_, part) => ({
    kind: 'night' as const,
    heading,
    sub: parts > 1 ? `${sub} · ${part + 1}/${parts}` : sub,
    rows: events.slice(part * perCard, (part + 1) * perCard).map(toRow),
  }));
}

function toRow(event: EventCardDto): NightRow {
  return {
    time: formatClock(event.startAt),
    title: event.title,
    place: placeOf(event),
    styles: styleFamilies(event.danceStyles).join(' · '),
    price: formatPrice(event),
    flyerUrl: event.flyerUrl,
  };
}

/** "Bachata Sensual", "Salsa Cubana", "Salsa Portoricana" → Bachata, Salsa: a
 * card's line has no room for every style, and most nights list them all. */
function styleFamilies(styles: string[]): string[] {
  return [...new Set(styles.map((style) => style.trim().split(/\s+/)[0]))];
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
    title: event.title,
    place: placeOf(event),
    address: addressLine(event.address),
    styles: event.danceStyles.join(' · '),
    flyerUrl: event.flyerUrl,
  };
}

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

/** The agenda: a cover, each night's events and a card that sends to the
 * site, with the same nights in words as its text. `detailed` adds, after
 * the nights, a card of its own for every event (eventCard), in the same
 * order: the overview first, then each venue's night in full. Null with no
 * events. */
export function agendaDeck(
  events: EventCardDto[],
  range: AgendaRange,
  city: string,
  now: number,
  mentionsOf: Mentions,
  detailed: boolean,
): Deck | null {
  const nights = byNight(events, now);
  if (!nights.length) return null;
  const when = AGENDA_RANGES.find((option) => option.value === range)!.when;
  const first = nights[0].night;
  const last = nights[nights.length - 1].night;

  const cards: Card[] = [
    {
      kind: 'cover',
      kicker: null,
      title: 'Dove si balla',
      flair: `${when}?`,
      sub: `Salsa e bachata a ${city}`,
      accent: first === last ? nightDate(first, 'long') : `${nightDate(first, 'short')} – ${nightDate(last, 'short')}`,
      note: `${events.length} ${events.length === 1 ? 'serata' : 'serate'} · scorri →`,
    },
  ];
  const lines = [`Dove si balla ${when} a ${city}? 💃🕺`];
  for (const { night, events: sameNight } of nights) {
    const date = nightDate(night, 'long');
    const [weekday, ...rest] = date.split(' ');
    cards.push(...nightCards(sameNight, capitalize(weekday), rest.join(' ')));
    lines.push('', date.toUpperCase());
    for (const event of sameNight) {
      // The mentions close the line: nothing after a username that Instagram
      // could take for part of it.
      const what = [event.title, event.venueName].filter(Boolean).join(', ');
      lines.push([`• ${formatClock(event.startAt)} — ${what}`, ...mentionsOf(event)].join(' '));
    }
  }
  if (detailed) cards.push(...nights.flatMap((night) => night.events.map(eventCard)));
  cards.push({
    kind: 'outro',
    title: 'Tutte le serate,',
    flair: 'ogni giorno.',
    note: `Mappa, lista e scuole di salsa e bachata a ${city}`,
  });
  lines.push('', 'Tutte le serate, giorno per giorno, su ballastasera.it (link in bio).', '', hashtags(city));

  return {
    slug: `agenda-${range}${detailed ? '-dettagli' : ''}`,
    format: 'post',
    cards,
    textLabel: 'Testo del post',
    textHint:
      'Ogni @ è il profilo salvato per quel locale o organizzatore: incollato nel testo del post diventa una menzione da solo. Dove non c’è, manca il profilo nella scheda.',
    text: lines.join('\n'),
  };
}

/** One night as a story: its events, a story's height each MAX_ROWS of them.
 * A story has no text: what's handed over is who to mention on it. */
export function storyDeck(
  events: EventCardDto[],
  day: StoryDay,
  city: string,
  now: number,
  mentionsOf: Mentions,
): Deck | null {
  const [night] = byNight(events, now);
  if (!night) return null;
  const heading = STORY_DAYS.find((option) => option.value === day)!.heading;
  return {
    slug: `story-${day}`,
    format: 'story',
    cards: nightCards(night.events, heading, `${capitalize(nightDate(night.night, 'long'))} · ${city}`),
    textLabel: 'Da menzionare nella story',
    textHint:
      'Una story non ha testo: aggiungi l’adesivo "Link" verso ballastasera.it/lista e menziona questi profili con l’adesivo "Menzione", così possono ricondividerla con un tocco.',
    text: [...new Set(night.events.flatMap(mentionsOf))].join(' '),
  };
}

/** In the picker of the nights: "ven 16 ott · 22:00 · Vibra Latina — Zoo Club". */
export function eventLabel(event: EventCardDto): string {
  const when = `${nightDate(startNight(event), 'short')} · ${formatClock(event.startAt)}`;
  return `${when} · ${[event.title, event.venueName].filter(Boolean).join(' — ')}`;
}

/** One night on its own, as a story or a post: the picture a venue shares
 * without its neighbours on it. With it, the profiles to mention and, for a
 * story, the night's page for the link sticker; for a post, its text. */
export function eventDeck(event: EventCardDto, format: Format, city: string, mentionsOf: Mentions): Deck {
  const profiles = mentionsOf(event).join(' ');
  const deck = { slug: `serata-${event.slug || event.id}-${format}`, format, cards: [eventCard(event)] };
  if (format === 'story') {
    return {
      ...deck,
      textLabel: 'Da menzionare e da linkare',
      textHint:
        'Prima riga: i profili da menzionare con l’adesivo "Menzione", così il locale la ricondivide con un tocco. Seconda riga: la pagina della serata, per l’adesivo "Link".',
      text: [profiles, `https://ballastasera.it/evento/${event.id}`].filter(Boolean).join('\n'),
    };
  }
  return {
    ...deck,
    textLabel: 'Testo del post',
    textHint:
      'Gli @ in fondo sono i profili salvati del locale e dell’organizzatore: incollati nel testo diventano menzioni da soli.',
    text: [
      `${event.title} 💃🕺`,
      '',
      `📅 ${capitalize(nightDate(startNight(event), 'long'))}, dalle ${formatClock(event.startAt)}`,
      `📍 ${[event.venueName, addressLine(event.address)].filter(Boolean).join(', ')}`,
      ...(event.danceStyles.length ? [`🎵 ${event.danceStyles.join(', ')}`] : []),
      `🎟 ${formatPrice(event)}`,
      ...(profiles ? ['', profiles] : []),
      '',
      'Questa e tutte le altre serate su ballastasera.it (link in bio).',
      '',
      hashtags(city),
    ].join('\n'),
  };
}
