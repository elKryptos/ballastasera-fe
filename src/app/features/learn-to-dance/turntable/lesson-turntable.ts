import { Component, computed, inject, signal } from '@angular/core';
import { BPM, CountKind, Dance, LessonClock, Performer, SoundMode, countsFor } from '../lesson';

/**
 * How "bachata" on the cover sways to the count: three steps one way (in
 * em), the hip up on the tap, three back, hip again — the basic, in a word.
 */
const SWAY = [
  { x: -0.05, y: 0, r: 0 },
  { x: -0.1, y: 0, r: 0 },
  { x: -0.15, y: 0, r: 0 },
  { x: -0.15, y: -0.05, r: -3 },
  { x: -0.1, y: 0, r: 0 },
  { x: -0.05, y: 0, r: 0 },
  { x: 0, y: 0, r: 0 },
  { x: 0, y: -0.05, r: 3 },
];

/**
 * The record on the cover, playable: a tap puts the needle down and the
 * lesson's band plays side A (salsa) or B (bachata) at the music's own
 * speed, on the same clock as the stages — starting one stops the other.
 * It plays on while the page scrolls (music to read the lesson by), and
 * stops with the tab hidden (see LessonClock).
 *
 * Also beats time for the cover's title, which dances along: `hop` and
 * `sway` are what "Salsa" and "bachata" do on the current count.
 */
@Component({
  selector: 'app-lesson-turntable',
  templateUrl: './lesson-turntable.html',
  styleUrl: './lesson-turntable.css',
  host: { '[style.--beat]': 'beatMs() + "ms"' },
})
export class LessonTurntable implements Performer {
  private readonly clock = inject(LessonClock);

  readonly dance = signal<Dance>('salsa');
  /** The count playing, 0–7; -1 between plays. */
  readonly beat = signal(-1);
  readonly live = computed(() => this.clock.playing() === this);
  readonly beatMs = computed(() => Math.round(60000 / BPM[this.dance()].full));

  /** "Salsa" hops on the steps (1-2-3, 5-6-7) and holds still on the pauses. */
  readonly hop = computed(() => {
    const beat = this.beat();
    if (!this.live() || this.dance() !== 'salsa' || beat < 0 || this.countKind(beat) !== 'step') return null;
    return beat % 2 ? 'b' : 'a';
  });

  readonly sway = computed(() => {
    const beat = this.beat();
    if (!this.live() || this.dance() !== 'bachata' || beat < 0) return null;
    const { x, y, r } = SWAY[beat];
    return { translate: `${x}em ${y}em`, rotate: `${r}deg` };
  });

  // ---------- Performer ----------

  readonly beatSeconds = (): number => this.beatMs() / 1000;
  readonly countKind = (index: number): CountKind => countsFor(this.dance(), 'lead')[index].kind;
  readonly show = (index: number): void => this.beat.set(index);
  /** A record plays its music whatever the stages' sound switch says. */
  readonly soundMode = (): SoundMode => 'band';

  // ---------- the controls ----------

  protected toggle(): void {
    if (this.live()) {
      this.clock.stop();
      this.beat.set(-1);
      return;
    }
    this.clock.start(this, 0);
  }

  /** Turns the record over; if it was playing, the other side starts from its 1. */
  protected pick(side: Dance): void {
    if (side === this.dance()) return;
    this.dance.set(side);
    if (this.live()) {
      this.beat.set(-1);
      this.clock.start(this, 0);
    }
  }
}
