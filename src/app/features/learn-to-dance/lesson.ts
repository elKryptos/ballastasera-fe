import { DOCUMENT, OnDestroy, Service, inject, signal } from '@angular/core';
import { Channel, LessonBand } from './lesson-band';

/**
 * The dance schools' list, where the lesson sends whoever wants a teacher
 * next — from the cover, the chapter bar and the closing call.
 */
export const SCHOOLS_PATH = '/scuole';

export type Dance = 'salsa' | 'bachata';
export type Role = 'lead' | 'follow';
export type Tempo = 'slow' | 'full';
type Foot = 'L' | 'R';
export type CountKind = 'step' | 'pause' | 'tap';

/** Where a foot stands on the stage's floor: px from its centre, forward is -y. */
export type Spot = readonly [x: number, y: number];

/** One count of a basic step: where both feet are once it lands. */
export interface Count {
  l: Spot;
  r: Spot;
  /** The foot holding the weight at the end of the count. */
  weight: Foot;
  /** The foot that moves (or rocks in place) on this count; none on a pause. */
  moved?: Foot;
  kind: CountKind;
  /** What to do, as the caption under the stage says it. */
  say: string;
  hint: string;
  /** The same, short enough for the count's button. */
  short: string;
}

/** Beats per minute: a slowed-down one to learn on, then the music's own. */
export const BPM: Record<Dance, Record<Tempo, number>> = {
  salsa: { slow: 100, full: 176 },
  bachata: { slow: 88, full: 128 },
};

/**
 * Both basics as the one who leads dances them, starting with the left
 * foot; the one who follows mirrors them (see countsFor). Salsa goes forward
 * and back, pausing on 4 and 8; bachata goes side to side, tapping on 4 and 8.
 */
const LEAD: Record<Dance, readonly Count[]> = {
  salsa: [
    { l: [-22, -66], r: [22, 0], weight: 'L', moved: 'L', kind: 'step', say: 'Sinistro avanti', hint: 'Un passo piccolo: il peso passa tutto davanti.', short: 'Sx avanti' },
    { l: [-22, -66], r: [22, 0], weight: 'R', moved: 'R', kind: 'step', say: 'Destro sul posto', hint: 'Il destro non si sposta: si riprende il peso.', short: 'Dx sul posto' },
    { l: [-22, 0], r: [22, 0], weight: 'L', moved: 'L', kind: 'step', say: 'Sinistro al centro', hint: 'Torna accanto al destro.', short: 'Sx al centro' },
    { l: [-22, 0], r: [22, 0], weight: 'L', kind: 'pause', say: 'Pausa', hint: 'I piedi stanno fermi, i fianchi finiscono il movimento.', short: 'Pausa' },
    { l: [-22, 0], r: [22, 66], weight: 'R', moved: 'R', kind: 'step', say: 'Destro indietro', hint: 'Lo stesso, dall’altra parte: ora si va indietro.', short: 'Dx indietro' },
    { l: [-22, 0], r: [22, 66], weight: 'L', moved: 'L', kind: 'step', say: 'Sinistro sul posto', hint: 'Il sinistro non si sposta: si riprende il peso.', short: 'Sx sul posto' },
    { l: [-22, 0], r: [22, 0], weight: 'R', moved: 'R', kind: 'step', say: 'Destro al centro', hint: 'Torna accanto al sinistro: piedi uniti.', short: 'Dx al centro' },
    { l: [-22, 0], r: [22, 0], weight: 'R', kind: 'pause', say: 'Pausa', hint: 'Respira: si riparte dall’1.', short: 'Pausa' },
  ],
  bachata: [
    { l: [-20, 0], r: [60, 0], weight: 'L', moved: 'L', kind: 'step', say: 'Sinistro di lato', hint: 'Un passo a sinistra, non più largo delle spalle.', short: 'Sx di lato' },
    { l: [-20, 0], r: [20, 0], weight: 'R', moved: 'R', kind: 'step', say: 'Destro si chiude', hint: 'Avvicinalo al sinistro e prendi il peso.', short: 'Dx chiude' },
    { l: [-60, 0], r: [20, 0], weight: 'L', moved: 'L', kind: 'step', say: 'Sinistro di lato', hint: 'Ancora un passo nella stessa direzione.', short: 'Sx di lato' },
    { l: [-60, 0], r: [-20, 0], weight: 'L', moved: 'R', kind: 'tap', say: 'Tap del destro', hint: 'Tocca il pavimento senza peso: l’anca sale.', short: 'Tap dx' },
    { l: [-60, 0], r: [20, 0], weight: 'R', moved: 'R', kind: 'step', say: 'Destro di lato', hint: 'Si cambia direzione: a destra.', short: 'Dx di lato' },
    { l: [-20, 0], r: [20, 0], weight: 'L', moved: 'L', kind: 'step', say: 'Sinistro si chiude', hint: 'Avvicinalo al destro e prendi il peso.', short: 'Sx chiude' },
    { l: [-20, 0], r: [60, 0], weight: 'R', moved: 'R', kind: 'step', say: 'Destro di lato', hint: 'Ancora un passo nella stessa direzione.', short: 'Dx di lato' },
    { l: [20, 0], r: [60, 0], weight: 'R', moved: 'L', kind: 'tap', say: 'Tap del sinistro', hint: 'Tocca senza peso, l’anca sale: si riparte.', short: 'Tap sx' },
  ],
};

const OPPOSITE: Record<string, string> = {
  sinistro: 'destro',
  destro: 'sinistro',
  sinistra: 'destra',
  destra: 'sinistra',
  avanti: 'indietro',
  indietro: 'avanti',
  davanti: 'dietro',
  dietro: 'davanti',
  sx: 'dx',
  dx: 'sx',
};

/** Swaps every side and direction in a line, keeping its capitals. */
function mirrorText(text: string): string {
  return text.replace(/\b(sinistr[oa]|destr[oa]|avanti|indietro|davanti|dietro|sx|dx)\b/gi, (word) => {
    const swap = OPPOSITE[word.toLowerCase()];
    return word[0] === word[0].toUpperCase() ? swap[0].toUpperCase() + swap.slice(1) : swap;
  });
}

const flip = ([x, y]: Spot): Spot => [-x || 0, -y || 0];
const other = (foot: Foot | undefined): Foot | undefined => foot && (foot === 'L' ? 'R' : 'L');

/**
 * The basic as `role` dances it, each seen from the dancer's own place
 * (forward is up for both). Following mirrors the lead: the other foot,
 * the other way.
 */
export function countsFor(dance: Dance, role: Role): readonly Count[] {
  if (role === 'lead') return LEAD[dance];
  return LEAD[dance].map((c) => ({
    ...c,
    l: flip(c.r),
    r: flip(c.l),
    weight: other(c.weight)!,
    moved: other(c.moved),
    say: mirrorText(c.say),
    hint: mirrorText(c.hint),
    short: mirrorText(c.short),
  }));
}

/** Silence, the metronome alone, or the band. */
export type SoundMode = 'off' | 'count' | 'band';

/** What the clock needs from whatever it plays for: a stage, or the record on the cover. */
export interface Performer {
  readonly dance: () => Dance;
  /** Read again for every count, so a change of tempo lands on the next one. */
  readonly beatSeconds: () => number;
  readonly countKind: (index: number) => CountKind;
  /** Called for each count as it sounds. */
  readonly show: (index: number) => void;
  /**
   * Called `leadSeconds` before a count sounds, for what must already be on
   * its way: a foot lands on the beat, it doesn't set off on it.
   */
  readonly prepare?: (index: number) => void;
  readonly leadSeconds?: () => number;
  /** Its own sound, whatever the shared switch says. */
  readonly soundMode?: () => SoundMode;
}

interface Run {
  performer: Performer;
  /** On the AudioContext's clock, with sound; or on the page's, silent, while audio isn't allowed yet. */
  audio?: AudioContext;
  /** The next count to schedule, 0–7, and when it falls on the run's clock. */
  next: number;
  at: number;
  /** Eight-counts played so far: picks the bar of the band's progression. */
  cycle: number;
  /** Counts scheduled but not yet shown, oldest first. */
  queue: { index: number; at: number; prepared: boolean }[];
  /** This run's own mixer (its reverb and echo included), faded out on stop so nothing scheduled lingers. */
  bus?: Channel;
  timer: ReturnType<typeof setInterval>;
  frame: number;
}

/** How far ahead counts are put on the clock, and how often that's topped up. */
const LOOKAHEAD = 0.12;
const TICK_MS = 25;

/**
 * Shared by the lesson's two stages and the record on the cover, provided
 * by the page. Keeps time for whichever of them plays — one at a time,
 * starting one stops the other — and plays its sound: the metronome or the
 * band (LessonBand).
 *
 * Time is the AudioContext's own, not setTimeout's: each count is put on
 * the audio clock a little ahead of time, and the stage is told about it
 * only when it actually sounds, so the feet and the music never drift
 * apart, whatever the tempo. The context is created on the first play,
 * inside the tap that asked for it, as browsers require before any sound;
 * should the browser still hold it back, the lesson keeps time silently on
 * the page's clock and joins the music the moment audio starts.
 */
@Service({ autoProvided: false })
export class LessonClock implements OnDestroy {
  /** The stage playing right now, if any. */
  readonly playing = signal<Performer | null>(null);
  readonly sound = signal<SoundMode>('band');

  private audio?: AudioContext;
  private master?: AudioNode;
  private band?: LessonBand;
  private taps?: Channel;
  private run?: Run;
  /** A start waiting on its band's instruments; a stop meanwhile cancels it. */
  private pending?: object;

  private readonly document = inject(DOCUMENT);
  /** A hidden tab stops whatever plays: timers there are throttled, and the music would stutter. */
  private readonly onHidden = (): void => {
    if (this.document.hidden) this.stop();
  };

  /**
   * Plays `performer` from count `from` (0–7) on, until stopped. The band's
   * instruments load on a dance's first play: the stage shows itself
   * playing at once, and the count begins as soon as they're in.
   */
  start(performer: Performer, from: number): void {
    this.stop();
    const ctx = this.context();
    this.playing.set(performer);
    const dance = performer.dance();
    const band = this.band;
    if (!band || (performer.soundMode?.() ?? this.sound()) !== 'band' || band.ready(dance)) {
      this.begin(performer, from, ctx);
      return;
    }
    const token = {};
    this.pending = token;
    const go = (): void => {
      if (this.pending !== token) return;
      this.pending = undefined;
      this.begin(performer, from, ctx);
    };
    band.prepare(dance).then(go, go);
  }

  private begin(performer: Performer, from: number, ctx: AudioContext | undefined): void {
    const audio = ctx?.state === 'running' ? ctx : undefined;
    const run: Run = {
      performer,
      audio,
      next: from,
      at: 0,
      cycle: 0,
      queue: [],
      bus: audio && this.bus(),
      timer: setInterval(() => this.schedule(run), TICK_MS),
      frame: 0,
    };
    // The first count waits out the lead, so its step can land on it too.
    run.at = this.now(run) + 0.05 + this.lead(run);
    const show = (): void => {
      // What's heard lags the audio clock by the processing and output latency.
      const heard = this.now(run) - (run.audio ? run.audio.baseLatency + (run.audio.outputLatency || 0) : 0);
      const lead = this.lead(run);
      for (const count of run.queue) {
        if (!count.prepared && count.at - lead <= heard) {
          count.prepared = true;
          performer.prepare?.(count.index);
        }
      }
      while (run.queue.length && run.queue[0].at <= heard) performer.show(run.queue.shift()!.index);
      run.frame = requestAnimationFrame(show);
    };
    this.run = run;
    this.schedule(run);
    run.frame = requestAnimationFrame(show);
  }

  stop(): void {
    this.pending = undefined;
    const run = this.run;
    if (run) {
      clearInterval(run.timer);
      cancelAnimationFrame(run.frame);
      if (run.bus && run.audio) run.bus.close(run.audio.currentTime);
      this.run = undefined;
    }
    this.playing.set(null);
  }

  /** One count on its own, right now: what a tap on a count's button plays. */
  playOne(performer: Performer, index: number): void {
    const ctx = this.context();
    if (ctx?.state !== 'running') return;
    this.taps ??= this.bus();
    this.sounds(performer, index, 0, ctx.currentTime + 0.01, this.taps);
  }

  private schedule(run: Run): void {
    // Fallen behind (a stalled timer): pick the beat up again from now, rather
    // than firing every missed count at once.
    const ahead = LOOKAHEAD + this.lead(run);
    if (run.at < this.now(run) - 0.1) run.at = this.now(run) + 0.05 + this.lead(run);
    while (run.at < this.now(run) + ahead) {
      if (run.bus) this.sounds(run.performer, run.next, run.cycle, run.at, run.bus);
      run.queue.push({ index: run.next, at: run.at, prepared: false });
      run.at += run.performer.beatSeconds();
      run.next = (run.next + 1) % 8;
      if (run.next === 0) run.cycle++;
    }
  }

  private sounds(performer: Performer, index: number, cycle: number, at: number, out: Channel): void {
    const mode = performer.soundMode?.() ?? this.sound();
    if (mode === 'off' || !this.band) return;
    if (mode !== 'band') {
      this.band.click(performer.countKind(index), index === 0, at, out);
      return;
    }
    // Switched to the band mid-run, or a single count tapped before its first play:
    // fetch the instruments, and let the band join once they're in.
    const dance = performer.dance();
    if (!this.band.ready(dance)) {
      void this.band.prepare(dance);
      return;
    }
    this.band.play(dance, index, cycle, at, performer.beatSeconds(), out);
  }

  private lead(run: Run): number {
    return run.performer.leadSeconds?.() ?? 0;
  }

  private now(run: Run): number {
    return run.audio ? run.audio.currentTime : performance.now() / 1000;
  }

  private context(): AudioContext | undefined {
    if (typeof AudioContext === 'undefined') return undefined;
    if (!this.audio) {
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      // A gentle glue on the whole mix, so the band never clips.
      const squeeze = ctx.createDynamicsCompressor();
      squeeze.threshold.value = -16;
      squeeze.ratio.value = 4;
      const level = ctx.createGain();
      level.gain.value = 1.15;
      level.connect(squeeze).connect(ctx.destination);
      // Audio let through only now: carry on from the next count, with sound.
      ctx.addEventListener('statechange', () => {
        const run = this.run;
        if (ctx.state === 'running' && run && !run.audio) this.start(run.performer, run.next);
      });
      this.audio = ctx;
      this.master = level;
      this.band = new LessonBand(ctx);
      this.document.addEventListener('visibilitychange', this.onHidden);
    }
    void this.audio.resume();
    return this.audio;
  }

  private bus(): Channel {
    return this.band!.channel(this.master!);
  }

  /** Leaving the page stops everything: the stages and the record go with it. */
  ngOnDestroy(): void {
    this.stop();
    this.document.removeEventListener('visibilitychange', this.onHidden);
    void this.audio?.close();
  }
}
