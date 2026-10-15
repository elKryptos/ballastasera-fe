import { Dance } from '../../learn-to-dance/lesson';
import {
  COUPLE_PRINCIPLES,
  DANCE_CHAPTERS,
  FLOOR_MANNERS,
  MISTAKES,
  RHYTHM_TIPS,
} from '../../learn-to-dance/lesson-content';
import { Card } from './cards';
import { Deck, Kind } from './deck';

/** What's published from the lesson (/impara-a-ballare): a chapter each, its
 * points one per card, in the lesson's own words (lesson-content.ts) — as a
 * carousel, as a run of stories, or as a reel that plays them (Kind).
 * Only the covers' one-liners are written here: a cover wants a line, where
 * the lesson's chapters open with a paragraph. */

const OUTRO: Card = {
  kind: 'outro',
  title: 'La lezione intera,',
  flair: 'passo dopo passo.',
  note: 'Ritmo, passo base animato, ballo in coppia e playlist',
};

const HASHTAGS = '#salsa #bachata #imparaaballare #ballilatini #passobase #salsamilano #bachatamilano';

interface Chapter {
  slug: string;
  /** In the page's picker. */
  label: string;
  kicker: string;
  title: string;
  flair: string;
  sub: string;
  /** "5 regole": how many cards follow, on the cover. */
  count: string;
  points: Card[];
  /** The same points as the post's text, a line each. */
  lines: string[];
}

/** Points with a title, one a card, and the same as numbered lines of
 * text. `label` names a card from its place among them ("2 di 3"). */
function titled(
  items: { title: string; copy: string }[],
  label: (place: string) => string,
): Pick<Chapter, 'points' | 'lines'> {
  return {
    points: items.map((item, i) => ({
      kind: 'point',
      label: label(`${i + 1} di ${items.length}`),
      title: item.title,
      copy: item.copy,
    })),
    lines: items.map((item, i) => `${i + 1}. ${item.title}. ${item.copy}`),
  };
}

function danceChapters(dance: Dance): Chapter[] {
  const chapter = DANCE_CHAPTERS[dance];
  const name = dance === 'salsa' ? 'Salsa' : 'Bachata';
  return [
    {
      slug: `${dance}-tre-cose`,
      label: `${name}: tre cose da sapere`,
      kicker: chapter.origin,
      title: `${name}:`,
      flair: 'tre cose da sapere',
      sub: `Si conta ${chapter.facts[0].v}. Prima di mettere i piedi in pista, queste.`,
      count: '3 cose',
      ...titled(chapter.tips, (place) => `${name} · ${place}`),
    },
    {
      slug: `${dance}-stili`,
      label: `${name}: gli stili`,
      kicker: chapter.origin,
      title: `${name}:`,
      flair: 'gli stili che incontrerai',
      sub: 'Stessa musica, tre modi di ballarla. Riconoscili in pista.',
      count: `${chapter.styles.length} stili`,
      points: chapter.styles.map((style) => ({ kind: 'point', label: `${name} · stile`, title: style.name, copy: style.copy })),
      lines: chapter.styles.map((style) => `• ${style.name}. ${style.copy}`),
    },
  ];
}

const CHAPTERS: Chapter[] = [
  {
    slug: 'galateo',
    label: 'Il galateo della pista',
    kicker: 'Impara a ballare',
    title: 'Il galateo',
    flair: 'della pista',
    sub: 'Le regole non scritte della tua prima serata.',
    count: `${FLOOR_MANNERS.length} regole`,
    points: FLOOR_MANNERS.map((manner, i) => ({ kind: 'point', label: `Ballo n°${i + 1}`, title: null, copy: manner })),
    lines: FLOOR_MANNERS.map((manner, i) => `${i + 1}. ${manner}`),
  },
  {
    slug: 'errori',
    label: 'Gli errori che facciamo tutti',
    kicker: 'Impara a ballare',
    title: 'Gli errori che',
    flair: 'facciamo tutti',
    sub: 'I classici delle prime serate: riconoscerli è già metà del lavoro.',
    count: `${MISTAKES.length} errori`,
    points: MISTAKES.map((mistake, i) => ({
      kind: 'versus',
      label: `Errore n°${i + 1}`,
      wrong: mistake.wrong,
      right: mistake.right,
    })),
    lines: MISTAKES.map((mistake) => `✗ ${mistake.wrong}\n✓ ${mistake.right}`),
  },
  {
    slug: 'ritmo',
    label: 'Il ritmo: conta in otto',
    kicker: 'Impara a ballare',
    title: 'Prima dei piedi,',
    flair: 'le orecchie',
    sub: 'Salsa e bachata si contano in otto. Tre esercizi prima del primo passo.',
    count: `${RHYTHM_TIPS.length} esercizi`,
    ...titled(RHYTHM_TIPS, (place) => `Esercizio ${place}`),
  },
  {
    slug: 'coppia',
    label: 'Si balla in due',
    kicker: 'Impara a ballare',
    title: 'Si balla',
    flair: 'in due',
    sub: 'Chi guida propone, chi segue interpreta. E nessuno dei due trascina l’altro.',
    count: `${COUPLE_PRINCIPLES.length} principi`,
    ...titled(COUPLE_PRINCIPLES, (place) => `In coppia · ${place}`),
  },
  ...danceChapters('salsa'),
  ...danceChapters('bachata'),
];

/** For the page's picker, in the order above. */
export const LESSON_DECKS: { slug: string; label: string }[] = CHAPTERS.map(({ slug, label }) => ({ slug, label }));

const LESSON_LINK = 'https://ballastasera.it/impara-a-ballare';

export function lessonDeck(slug: string, kind: Kind): Deck | null {
  const chapter = CHAPTERS.find((option) => option.slug === slug);
  if (!chapter) return null;
  const cards: Card[] = [
    {
      kind: 'cover',
      kicker: chapter.kicker,
      title: chapter.title,
      flair: chapter.flair,
      sub: chapter.sub,
      accent: null,
      note: kind === 'post' ? `${chapter.count} · scorri →` : chapter.count,
    },
    ...chapter.points,
    OUTRO,
  ];
  const deck = {
    slug: `${kind}-lezione-${chapter.slug}`,
    kind,
    cards,
    // Nobody to mention on a lesson; a story's link sticker goes to it.
    notes: cards.map(() => ({ mentions: '', link: kind === 'story' ? LESSON_LINK : null })),
  };
  if (kind === 'story') {
    return {
      ...deck,
      textLabel: 'Link per l’adesivo',
      textHint: 'Metti l’adesivo "Link" sull’ultima story (o su tutte): porta alla lezione intera.',
      text: LESSON_LINK,
    };
  }
  return {
    ...deck,
    textLabel: kind === 'reel' ? 'Testo del reel' : 'Testo del post',
    textHint:
      kind === 'reel'
        ? 'Il video è muto: quando lo pubblichi aggiungi una canzone dalla musica di Instagram.'
        : 'Chiudi con una domanda (“Qual è stato il tuo?”): i commenti sono ciò che fa girare un post.',
    text: [
      `${chapter.title} ${chapter.flair} 💃🕺`,
      '',
      chapter.sub,
      '',
      ...chapter.lines,
      '',
      'La lezione intera, con il passo base animato, è su ballastasera.it/impara-a-ballare (link in bio).',
      '',
      HASHTAGS,
    ].join('\n'),
  };
}
