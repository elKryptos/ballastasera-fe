import { EventCardDto } from '../../../core/models/event.model';
import { DateRange, eventNight, nightDate } from '../../../core/utils/event-filters';
import { formatClock, formatPrice, instagramHandle } from '../../../core/utils/event-format';
import { Card, MAX_ROWS, NightRow } from './cards';
import { Deck } from './deck';

/** The posts made from the events: the agenda (a carousel, a night per card)
 * and tonight's story. `events` are already the range's (inDateRange). */

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

/** The events by night, earliest first, each night by start time. */
function byNight(events: EventCardDto[], now: number): Night[] {
  const nights = new Map<number, EventCardDto[]>();
  for (const event of events) {
    const night = eventNight(event, now);
    const sameNight = nights.get(night);
    if (sameNight) sameNight.push(event);
    else nights.set(night, [event]);
  }
  return Array.from(nights, ([night, sameNight]) => ({
    night,
    events: sameNight.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)),
  })).sort((a, b) => a.night - b.night);
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
    place: event.venueName ?? event.organizerName ?? '',
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

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** "@zoo_club_disco", once each: who to mention so they share it again. */
function handles(events: EventCardDto[]): string[] {
  return [...new Set(events.flatMap((event) => (event.organizerInstagram ? [`@${instagramHandle(event.organizerInstagram)}`] : [])))];
}

const cityTag = (city: string): string => city.toLowerCase().replace(/[^a-zà-ú]/g, '');

/** The agenda: a cover, each night's events and a card that sends to the
 * site, with the same nights in words as its text. Null with no events. */
export function agendaDeck(events: EventCardDto[], range: AgendaRange, city: string, now: number): Deck | null {
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
    const [weekday, ...date] = nightDate(night, 'long').split(' ');
    cards.push(...nightCards(sameNight, capitalize(weekday), date.join(' ')));
    lines.push('', nightDate(night, 'long').toUpperCase());
    for (const event of sameNight) {
      const handle = event.organizerInstagram ? ` (@${instagramHandle(event.organizerInstagram)})` : '';
      const place = event.venueName ? ` @ ${event.venueName}` : '';
      lines.push(`• ${formatClock(event.startAt)} — ${event.title}${place}${handle}`);
    }
  }
  cards.push({
    kind: 'outro',
    title: 'Tutte le serate,',
    flair: 'ogni giorno.',
    note: `Mappa, lista e scuole di salsa e bachata a ${city}`,
  });
  const tag = cityTag(city);
  lines.push(
    '',
    'Tutte le serate, giorno per giorno, su ballastasera.it (link in bio).',
    '',
    `#salsa #bachata #salsa${tag} #bachata${tag} #seratelatine #ballilatini #${tag}`,
  );

  return {
    slug: `agenda-${range}`,
    format: 'post',
    cards,
    textLabel: 'Testo del post',
    textHint: 'Tra parentesi i profili degli organizzatori: menzionarli è ciò che fa ricondividere il post.',
    text: lines.join('\n'),
  };
}

/** One night as a story: its events, a story's height each MAX_ROWS of them.
 * A story has no text: what's handed over is who to mention on it. */
export function storyDeck(events: EventCardDto[], day: StoryDay, city: string, now: number): Deck | null {
  const [night] = byNight(events, now);
  if (!night) return null;
  const heading = STORY_DAYS.find((option) => option.value === day)!.heading;
  return {
    slug: `story-${day}`,
    format: 'story',
    cards: nightCards(night.events, heading, `${capitalize(nightDate(night.night, 'long'))} · ${city}`),
    textLabel: 'Da menzionare nella story',
    textHint:
      'Una story non ha testo: aggiungi l’adesivo "Link" verso ballastasera.it/lista e menziona questi profili, così possono ricondividerla con un tocco.',
    text: handles(night.events).join(' '),
  };
}
