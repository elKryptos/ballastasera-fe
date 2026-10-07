import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SCHOOLS_PATH } from '../lesson';
import { Reveal } from '../reveal.directive';

const DISCO_COLORS = ['var(--sol)', 'var(--flamingo)', 'var(--laguna)', 'var(--fuego)'];

/** The floor: each tile with its own colour and moment to light up. The
 * same for both calls on the page. */
const TILES = Array.from({ length: 48 }, (_, i) => ({
  color: DISCO_COLORS[(i * 7) % 4],
  delay: `${((i * 37) % 29) / 10}s`,
}));

/**
 * The call to the schools — what the page is for: a big title over a dance
 * floor lighting up, a button to the schools' list and a way back into the
 * lesson. The page shows it twice: right after the cover, so everyone sees
 * it, and as the close, for whoever finished — each with its own words,
 * projected as the text under the title.
 */
@Component({
  selector: 'app-school-call',
  imports: [RouterLink, Reveal],
  templateUrl: './school-call.html',
  styleUrl: './school-call.css',
})
export class SchoolCall {
  readonly kicker = input.required<string>();
  readonly title = input.required<string>();
  /** The title's closing words, set apart in the romance italic. */
  readonly flair = input.required<string>();
  /** The second button's label: back into the lesson. */
  readonly back = input.required<string>();
  /** Where the lesson lies from here: below the opening call, above the closing one. */
  readonly direction = input<'up' | 'down'>('down');
  readonly toLesson = output<void>();

  protected readonly schools = SCHOOLS_PATH;

  protected readonly tiles = TILES;
}
