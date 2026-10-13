import { Component } from '@angular/core';
import { LessonHeading } from '../heading/lesson-heading';
import { MISTAKES } from '../lesson-content';
import { Reveal } from '../reveal.directive';

/**
 * Chapter 05: the beginner's classics, each struck out by a hand-drawn
 * stroke as it scrolls into view, with the fix written underneath.
 */
@Component({
  selector: 'app-lesson-mistakes',
  imports: [LessonHeading, Reveal],
  templateUrl: './lesson-mistakes.html',
  styleUrl: './lesson-mistakes.css',
})
export class LessonMistakes {
  /** Each card's slight tilt, so the six read as pinned up by hand. */
  protected readonly tilts = [-2, 1.5, -1, 2, -1.5, 1];

  protected readonly mistakes = MISTAKES;
}
