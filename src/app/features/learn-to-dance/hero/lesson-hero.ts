import { Component, output } from '@angular/core';
import { LessonTurntable } from '../turntable/lesson-turntable';

const KICKER = 'Impara a ballare';

/** One run of each ribbon; the template lays four end to end, so it loops seamlessly at half. */
const SALSA_RUN = ['Uno', 'Dos', 'Tres', 'pausa', 'Cinco', 'Seis', 'Siete', 'pausa'];
const BACHATA_RUN = ['uno', 'dos', 'tres', 'tap', 'cinco', 'seis', 'siete', 'tap'];

/**
 * The lesson's poster: the title dancing its own count ("Salsa" hops on
 * 1-2-3, 5-6-7; "bachata" sways three steps each way and pops its hip on
 * the taps), a record that plays when tapped — the title then dancing to
 * its music, count for count — and two ribbons crossing under it counting
 * in Spanish, as a teacher would.
 */
@Component({
  selector: 'app-lesson-hero',
  imports: [LessonTurntable],
  templateUrl: './lesson-hero.html',
  styleUrl: './lesson-hero.css',
})
export class LessonHero {
  /** A chapter to scroll to: 'ritmo', 'salsa' or 'bachata'. */
  readonly go = output<string>();

  protected readonly letters = [...KICKER];
  protected readonly runs = [0, 1, 2, 3];
  protected readonly salsaRun = SALSA_RUN;
  protected readonly bachataRun = BACHATA_RUN;
}
