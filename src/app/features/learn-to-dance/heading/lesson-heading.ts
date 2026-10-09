import { Component, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

/**
 * A chapter's opening: its number set huge and hollow behind, a mono
 * kicker, the title in the grotesk with its last words in the romance
 * italic, and whatever intro the chapter projects underneath. Takes its
 * colour from the --accent around it. The playlist's page opens with it
 * too: as the page's h1, with no number.
 */
@Component({
  selector: 'app-lesson-heading',
  imports: [NgTemplateOutlet],
  templateUrl: './lesson-heading.html',
  styleUrl: './lesson-heading.css',
})
export class LessonHeading {
  /** The chapter's number; none outside the lesson. */
  readonly n = input('');
  readonly kicker = input.required<string>();
  readonly title = input.required<string>();
  /** The title's closing words, set apart in italic. */
  readonly flair = input('');
  /** h2 for a chapter, h1 for a page of its own. */
  readonly level = input<1 | 2>(2);
}
