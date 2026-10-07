import { Component, input } from '@angular/core';

/**
 * A chapter's opening: its number set huge and hollow behind, a mono
 * kicker, the title in the grotesk with its last words in the romance
 * italic, and whatever intro the chapter projects underneath. Takes its
 * colour from the --accent around it.
 */
@Component({
  selector: 'app-lesson-heading',
  templateUrl: './lesson-heading.html',
  styleUrl: './lesson-heading.css',
})
export class LessonHeading {
  readonly n = input.required<string>();
  readonly kicker = input.required<string>();
  readonly title = input.required<string>();
  /** The title's closing words, set apart in italic. */
  readonly flair = input('');
}
