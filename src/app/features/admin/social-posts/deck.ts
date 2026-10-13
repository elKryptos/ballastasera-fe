import { Card, Format } from './cards';

/** One thing to publish: its pictures, in order, and the words that go with
 * them. Built from the events (agenda-decks.ts) or from the lesson
 * (lesson-decks.ts); drawn, downloaded and copied by SocialPosts. */
export interface Deck {
  /** In the pictures' file names: "ballastasera-<slug>-1.png". */
  slug: string;
  format: Format;
  cards: Card[];
  /** What's copied to paste in Instagram, what it's for and how to use it. */
  text: string;
  textLabel: string;
  textHint: string;
}
