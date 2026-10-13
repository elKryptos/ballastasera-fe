import { Component, computed, input } from '@angular/core';
import { Dance } from '../lesson';
import { DANCE_CHAPTERS } from '../lesson-content';
import { Reveal } from '../reveal.directive';
import { DanceStage } from '../stage/dance-stage';
import { LessonTonight } from '../tonight/lesson-tonight';

/**
 * Chapters 02 and 03: one dance, each with its own art — salsa a striped
 * 50s poster under a sunburst, bachata an italic name under a moon, its
 * guitar strings strummed — then the stage, three things to know and the
 * styles you'll meet on the floor.
 */
@Component({
  selector: 'app-lesson-dance',
  imports: [DanceStage, LessonTonight, Reveal],
  templateUrl: './lesson-dance.html',
  styleUrl: './lesson-dance.css',
  host: { '[class]': '"is-" + dance()' },
})
export class LessonDance {
  readonly dance = input.required<Dance>();
  protected readonly chapter = computed(() => DANCE_CHAPTERS[this.dance()]);
  protected readonly strings = [0, 1, 2, 3, 4, 5];
  protected readonly roman = ['I', 'II', 'III'];
}
