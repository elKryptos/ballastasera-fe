import { Component } from '@angular/core';
import { LessonHeading } from '../heading/lesson-heading';
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

  protected readonly mistakes = [
    { wrong: 'Guardare i piedi', right: 'Guarda il partner: i piedi sanno dove andare.' },
    { wrong: 'Fare passi lunghi', right: 'Passi piccoli, sempre sotto il corpo.' },
    { wrong: 'Saltare la pausa', right: 'Conta ad alta voce, almeno le prime volte.' },
    { wrong: 'Stringere la mano', right: 'Presa leggera: si guida col corpo, non con le dita.' },
    { wrong: 'Fermarsi a ogni errore', right: 'Resta a tempo: l’errore passa, il ritmo resta.' },
    { wrong: 'Ballare in apnea', right: 'Respira, sorridi, e se ti perdi riparti dall’1.' },
  ];
}
