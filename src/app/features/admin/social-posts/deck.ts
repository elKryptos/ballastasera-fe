import { Card, Format } from './cards';

/** What gets published: a post (a picture, or a carousel of them), a story
 * (or a run of them), or a reel — a video of story-sized pictures, one after
 * the other (see reel.ts). */
export type Kind = 'post' | 'story' | 'reel';

/** A reel is drawn on a story's frame. */
export const frameOf = (kind: Kind): Format => (kind === 'post' ? 'post' : 'story');

/** What goes with one picture when it's published on its own: who to mention
 * on it ("@a @b", '' for nobody) and, on a story, where its link sticker
 * leads. A reel's pictures have neither: it's one video. */
export interface CardNote {
  mentions: string;
  link: string | null;
}

/** One thing to publish: its pictures, in order, and the words that go with
 * them. Built from the events (event-decks.ts) or from the lesson
 * (lesson-decks.ts); drawn, recorded, downloaded and copied by SocialPosts. */
export interface Deck {
  /** In the files' names: "ballastasera-<slug>-1.jpg". */
  slug: string;
  kind: Kind;
  cards: Card[];
  /** One per card, in the same order. */
  notes: CardNote[];
  /** What's copied to paste in Instagram, what it's for and how to use it. */
  text: string;
  textLabel: string;
  textHint: string;
}
