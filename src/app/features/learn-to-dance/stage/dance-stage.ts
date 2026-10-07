import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';
import {
  BPM,
  CountKind,
  Dance,
  LessonClock,
  Performer,
  Role,
  SoundMode,
  Tempo,
  countsFor,
} from '../lesson';

const KIND_LABEL: Record<CountKind, string> = { step: 'passo', pause: 'pausa', tap: 'tap' };

const SOUNDS: { mode: SoundMode; label: string }[] = [
  { mode: 'off', label: 'Muto' },
  { mode: 'count', label: 'Clic' },
  { mode: 'band', label: 'Musica' },
];

const FEET = [
  { foot: 'L', mark: 'S' },
  { foot: 'R', mark: 'D' },
] as const;

/**
 * The basic step of one dance, played on a tilted dance floor seen from
 * above: two soles that step, rock and tap on the count, the dancer's
 * centre of weight gliding between them, and the count itself as a big
 * numeral. Plays to the lesson's clock — with its band, a metronome or
 * in silence — or one count at a time from the buttons; either role,
 * slowed down or at the music's speed.
 */
@Component({
  selector: 'app-dance-stage',
  templateUrl: './dance-stage.html',
  styleUrl: './dance-stage.css',
  host: {
    '[class]': '"is-" + dance()',
    '[style.--beat]': 'beatMs() + "ms"',
  },
})
export class DanceStage implements Performer {
  readonly dance = input.required<Dance>();

  private readonly clock = inject(LessonClock);
  protected readonly sound = this.clock.sound;
  protected readonly sounds = SOUNDS;
  protected readonly role = signal<Role>('lead');
  protected readonly tempo = signal<Tempo>('slow');
  /** The count on screen, 0–7; -1 until the first one is played. */
  protected readonly beat = signal(-1);
  /**
   * The count the feet are on their way to. Moves to the next one half a beat
   * before `beat` while playing, so each step lands on its count instead of
   * setting off on it.
   */
  protected readonly pose = signal(-1);
  protected readonly playing = computed(() => this.clock.playing() === this);

  protected readonly counts = computed(() => countsFor(this.dance(), this.role()));
  /** Before the first count, the feet wait where the last one leaves them. */
  protected readonly current = computed(() => this.counts()[this.beat() < 0 ? 7 : this.beat()]);
  protected readonly bpm = computed(() => BPM[this.dance()]);
  protected readonly beatMs = computed(() => Math.round(60000 / this.bpm()[this.tempo()]));
  protected readonly kindLabel = computed(() =>
    this.beat() < 0 ? 'pronti' : KIND_LABEL[this.current().kind],
  );
  /** One-item list, re-created on every count so the numeral's entrance replays. */
  protected readonly beatKey = computed(() => [this.beat()]);

  /** Where the feet are headed. */
  private readonly posed = computed(() => this.counts()[this.pose() < 0 ? 7 : this.pose()]);

  protected readonly feet = computed(() => {
    const count = this.posed();
    const beat = this.pose();
    return FEET.map(({ foot, mark }) => {
      const [x, y] = foot === 'L' ? count.l : count.r;
      const moves = beat >= 0 && count.moved === foot;
      return {
        foot,
        mark,
        x,
        y,
        weight: count.weight === foot,
        // Two names for the same lift, alternating with the count, so a foot
        // that moves on two counts in a row (tap, then step) lifts twice.
        lift: moves ? (beat % 2 ? 'b' : 'a') : null,
        tap: moves && count.kind === 'tap',
      };
    });
  });

  /** Centre of weight: most of the way over the foot that carries it. */
  protected readonly core = computed(() => {
    const { l, r, weight } = this.posed();
    const [on, off] = weight === 'L' ? [l, r] : [r, l];
    return { x: on[0] * 0.74 + off[0] * 0.26, y: on[1] * 0.74 + off[1] * 0.26 };
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

    // Scrolled away while playing: stop, rather than play on out of sight.
    // (A hidden tab or leaving the page stops it too — see LessonClock.)
    afterNextRender(() => {
      const observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting && this.playing()) this.clock.stop();
      });
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  // ---------- Performer: what the clock reads and calls ----------

  readonly beatSeconds = (): number => this.beatMs() / 1000;
  readonly countKind = (index: number): CountKind => this.counts()[index].kind;
  /** Half a beat: as long as a foot takes to travel (see .foot in the CSS). */
  readonly leadSeconds = (): number => this.beatSeconds() / 2;
  readonly prepare = (index: number): void => this.pose.set(index);
  readonly show = (index: number): void => {
    this.pose.set(index);
    this.beat.set(index);
  };

  // ---------- the controls ----------

  protected toggle(): void {
    if (this.playing()) this.clock.stop();
    else this.clock.start(this, (this.beat() + 1) % 8);
  }

  /** One count forward, without starting the clock. */
  protected stepOnce(): void {
    this.goTo((this.beat() + 1) % 8);
  }

  protected goTo(index: number): void {
    this.clock.stop();
    this.pose.set(index);
    this.beat.set(index);
    this.clock.playOne(this, index);
  }
}
