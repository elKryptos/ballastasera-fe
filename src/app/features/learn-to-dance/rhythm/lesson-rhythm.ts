import { Component } from '@angular/core';
import { LessonHeading } from '../heading/lesson-heading';
import { Reveal } from '../reveal.directive';

interface Pad {
  label: string;
  rest: boolean;
}

const pads = (rest: string): Pad[] =>
  Array.from({ length: 8 }, (_, i) => (i % 4 === 3 ? { label: rest, rest: true } : { label: 'passo', rest: false }));

/**
 * Chapter 01: counting before stepping. A two-row drum machine plays both
 * counts side by side, each at its own speed (pure CSS: one timeline per
 * row, each pad lit a beat after the one before), so the difference between
 * salsa's pause and bachata's tap shows before a single foot moves.
 */
@Component({
  selector: 'app-lesson-rhythm',
  imports: [LessonHeading, Reveal],
  templateUrl: './lesson-rhythm.html',
  styleUrl: './lesson-rhythm.css',
})
export class LessonRhythm {
  protected readonly salsa = pads('pausa');
  protected readonly bachata = pads('tap');

  protected readonly tips = [
    {
      title: 'Conta in otto',
      copy: 'Due battute da quattro: 1-2-3-4, 5-6-7-8. Ogni numero è un battito, e i passi vanno su quei numeri — non tra uno e l’altro.',
    },
    {
      title: 'Trova l’1',
      copy: 'È l’inizio della frase musicale, dove il pezzo sembra “ripartire”. Spesso è lì che entra la voce o cambia il giro del piano o della chitarra.',
    },
    {
      title: 'Prima le mani',
      copy: 'Metti un brano e batti le mani sull’1 e sul 5, senza muovere i piedi. Quando ti viene naturale, sei pronto per il passo base.',
    },
  ];
}
