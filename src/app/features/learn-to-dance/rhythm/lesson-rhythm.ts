import { Component } from '@angular/core';
import { LessonHeading } from '../heading/lesson-heading';
import { RHYTHM_TIPS } from '../lesson-content';
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

  protected readonly tips = RHYTHM_TIPS;
}
