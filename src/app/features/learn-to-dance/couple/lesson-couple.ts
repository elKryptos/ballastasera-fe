import { Component } from '@angular/core';
import { LessonHeading } from '../heading/lesson-heading';
import { COUPLE_PRINCIPLES, FLOOR_MANNERS } from '../lesson-content';
import { Reveal } from '../reveal.directive';

/**
 * Chapter 04: dancing as two. A pair of partners orbiting the one centre
 * they share — a half turn, a held beat, the other half — beside what
 * leading and following each ask of you; then the floor's manners, set as
 * an old ballroom dance card (a carnet de bal).
 */
@Component({
  selector: 'app-lesson-couple',
  imports: [LessonHeading, Reveal],
  templateUrl: './lesson-couple.html',
  styleUrl: './lesson-couple.css',
})
export class LessonCouple {
  protected readonly principles = COUPLE_PRINCIPLES;

  protected readonly manners = FLOOR_MANNERS;
}
