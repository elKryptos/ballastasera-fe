import type { Dance } from './lesson';
import { Drum, Instrument, Sample, SampleBank } from './lesson-samples';

/** A chord: its bass note and root as MIDI notes, its tones as semitones above the root. */
interface Chord {
  bass: number;
  root: number;
  tones: readonly number[];
}

const MAJOR = [0, 4, 7, 12];
const MINOR = [0, 3, 7, 12];
const DOM7 = [0, 4, 7, 10];

/**
 * Four bars to a turn, a chord a bar, so one turn spans two eight-counts.
 * Salsa in D minor, i–iv–V7–i: the turn a montuno lives on — and the same
 * minor cadence a tarantella goes round, so an Italian ear knows it before
 * it knows salsa. Bachata in E minor, Em–C–G–D: the four chords modern
 * bachata keeps coming back to.
 */
const PROGRESSION: Record<Dance, readonly Chord[]> = {
  salsa: [
    { bass: 38, root: 50, tones: MINOR },
    { bass: 43, root: 55, tones: MINOR },
    { bass: 45, root: 57, tones: DOM7 },
    { bass: 38, root: 50, tones: MINOR },
  ],
  bachata: [
    { bass: 40, root: 64, tones: MINOR },
    { bass: 36, root: 60, tones: MAJOR },
    { bass: 43, root: 67, tones: MAJOR },
    { bass: 38, root: 62, tones: MAJOR },
  ],
};

type Section = 'intro' | 'verse' | 'chorus';

/**
 * The loop after the intro, an eight-count per entry. Salsa builds: the
 * rhythm section's groove first, then the horns. Bachata opens on its hook.
 */
const FORM: Record<Dance, readonly Section[]> = {
  salsa: ['verse', 'verse', 'chorus', 'chorus'],
  bachata: ['chorus', 'chorus', 'verse', 'verse'],
};

/** Where an eight-count falls in the song. */
interface Place {
  section: Section;
  /** First or second eight-count of the four-bar turn. */
  phrase: 0 | 1;
  /** Whether it ends on a fill into what comes next. */
  fill: boolean;
}

/** The song's form: an intro once, then round FORM, a fill closing every turn. */
function place(dance: Dance, cycle: number): Place {
  if (cycle === 0) return { section: 'intro', phrase: 0, fill: true };
  const p = (cycle - 1) % 4;
  return { section: FORM[dance][p], phrase: (p % 2) as 0 | 1, fill: p % 2 === 1 };
}

/** A note of a tune: [eighth of the bar it starts on, MIDI note, length in eighths]. */
type Note = readonly [number, number, number];

/**
 * The hooks, a bar per chord. Salsa's is a horn figure — up the chord in
 * two quick notes, hold, step down, land — played on each chord in turn, so
 * one rhythm carries the whole turn and the ear has it by the second time.
 * Bachata's is a sung line for the requinto, falling through each chord and
 * climbing back up into the next turn.
 */
const HOOK: Record<Dance, readonly (readonly Note[])[]> = {
  salsa: [
    [[0, 69, 1], [1, 74, 1], [2, 77, 2], [4, 76, 1], [5, 74, 1], [6, 69, 2]],
    [[0, 70, 1], [1, 74, 1], [2, 79, 2], [4, 77, 1], [5, 74, 1], [6, 70, 2]],
    [[0, 73, 1], [1, 76, 1], [2, 81, 2], [4, 79, 1], [5, 76, 1], [6, 73, 2]],
    [[0, 74, 2], [2, 77, 1], [3, 76, 1], [4, 74, 3], [7, 69, 1]],
  ],
  bachata: [
    [[0, 79, 2], [2, 78, 1], [3, 76, 3], [6, 71, 1], [7, 76, 1]],
    [[0, 76, 2], [2, 74, 1], [3, 72, 3], [6, 67, 1], [7, 72, 1]],
    [[0, 74, 2], [2, 72, 1], [3, 71, 3], [6, 67, 1], [7, 71, 1]],
    [[0, 69, 2], [2, 74, 1], [3, 78, 3], [6, 76, 1], [7, 78, 1]],
  ],
};

/**
 * The piano's montuno, eighth by eighth: which chord tone it plays (an index
 * into the chord's tones, 4+ an octave higher), in octaves. The first bar is
 * the clave's 3 side, the second its 2 side.
 */
const MONTUNO: readonly Record<number, number>[] = [
  { 0: 2, 1: 3, 3: 2, 4: 1, 6: 2, 7: 3 },
  { 0: 2, 2: 1, 3: 0, 5: 1, 6: 2 },
];

/** The requinto's runs, sixteenth by sixteenth: up the chord and back, over a bar. */
const RUN = [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 5, 4, 3, 2];

/**
 * 3-2 son clave: the 3 side, then the 2 side. Played this way round so its
 * first stroke falls on the 1 — the count a beginner most needs to hear.
 */
const CLAVE: readonly (readonly number[])[] = [
  [0, 3, 6],
  [2, 4],
];

/**
 * The mixing desk: each instrument's place in the stereo field (-1 left to
 * 1 right), how much of it goes to the room and to the echo, and whether it
 * runs through the chorus (the requinto's shimmer).
 */
const STRIPS = {
  bass: [0, 0.04, 0, false],
  piano: [-0.18, 0.2, 0, false],
  trumpet: [0.14, 0.26, 0.05, false],
  trumpet2: [-0.1, 0.26, 0, false],
  trombone: [-0.28, 0.24, 0, false],
  guitar: [0.18, 0.3, 0.2, true],
  acoustic: [-0.35, 0.2, 0, false],
  conga: [0.32, 0.12, 0, false],
  bongo: [-0.28, 0.12, 0, false],
  bell: [-0.4, 0.12, 0, false],
  clave: [0.15, 0.15, 0, false],
  guiro: [0.42, 0.1, 0, false],
  shaker: [0.5, 0.08, 0, false],
  guira: [0.4, 0.1, 0, false],
  click: [0, 0, 0, false],
} as const satisfies Record<string, readonly [pan: number, room: number, echo: number, chorus: boolean]>;

export type Strip = keyof typeof STRIPS;

/**
 * One run's mixer: a strip per instrument (panned, with its sends), a room
 * (a convolution reverb) and an echo, all summed into `out`. `close` fades
 * it and lets it go.
 */
export class Channel {
  /** The channel's output: fading it silences everything on it, tails and all. */
  readonly out: GainNode;
  private readonly room: AudioNode;
  private readonly echo: DelayNode;
  private readonly strips = new Map<Strip, AudioNode>();
  private readonly lfos: OscillatorNode[] = [];

  constructor(
    private readonly ctx: BaseAudioContext,
    destination: AudioNode,
    impulse: AudioBuffer,
  ) {
    this.out = ctx.createGain();
    this.out.connect(destination);

    // The room: a short pre-delay, then the impulse response.
    const preDelay = ctx.createDelay(0.1);
    preDelay.delayTime.value = 0.02;
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse;
    preDelay.connect(reverb).connect(this.out);
    this.room = preDelay;

    // The echo: repeats that darken as they fade, and land in the room too.
    this.echo = ctx.createDelay(2);
    this.echo.delayTime.value = 0.3;
    const dark = ctx.createBiquadFilter();
    dark.type = 'lowpass';
    dark.frequency.value = 2800;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.3;
    const intoRoom = ctx.createGain();
    intoRoom.gain.value = 0.3;
    this.echo.connect(dark);
    dark.connect(feedback).connect(this.echo);
    dark.connect(this.out);
    dark.connect(intoRoom).connect(preDelay);
  }

  /** Echoes on the dotted eighth of the current beat. */
  tempo(beat: number, t: number): void {
    this.echo.delayTime.setTargetAtTime(beat * 0.75, t, 0.05);
  }

  /** The input of an instrument's strip, built the first time it's asked for. */
  strip(name: Strip): AudioNode {
    let input = this.strips.get(name);
    if (!input) {
      const { ctx } = this;
      const [pan, room, echo, chorus] = STRIPS[name];
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      gain.connect(panner).connect(this.out);
      if (chorus) {
        // A copy a few milliseconds late, its delay swaying slowly: the chorus pedal.
        const delay = ctx.createDelay(0.05);
        delay.delayTime.value = 0.018;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.8;
        const depth = ctx.createGain();
        depth.gain.value = 0.0035;
        lfo.connect(depth).connect(delay.delayTime);
        lfo.start();
        this.lfos.push(lfo);
        const wet = ctx.createGain();
        wet.gain.value = 0.55;
        gain.connect(delay).connect(wet).connect(panner);
      }
      if (room) {
        const send = ctx.createGain();
        send.gain.value = room;
        panner.connect(send).connect(this.room);
      }
      if (echo) {
        const send = ctx.createGain();
        send.gain.value = echo;
        gain.connect(send).connect(this.echo);
      }
      this.strips.set(name, gain);
      input = gain;
    }
    return input;
  }

  /** Fades the channel out from `t` and frees it once silent. */
  close(t: number): void {
    this.out.gain.setTargetAtTime(0, t, 0.06);
    setTimeout(() => {
      this.lfos.forEach((lfo) => lfo.stop());
      this.out.disconnect();
    }, 600);
  }
}

/**
 * The lesson's band: real instruments (see SampleBank), arranged as two
 * short songs with a hook — salsa with a piano montuno, a full Latin
 * percussion section and a horn mambo; bachata with the requinto on an
 * electric guitar through a chorus, güira, bongó, bass and segunda. Played
 * a count at a time, scheduled ahead on the AudioContext clock by
 * LessonClock, so the band and the feet on the stage share the same beat
 * at any tempo. Each dance's samples load on its first play.
 *
 * Mixed like a record, if a small one: panned, with a room and an echo
 * (see Channel); every hand-played stroke a few milliseconds and a few
 * percent of loudness off the grid, as hands are.
 */
export class LessonBand {
  private readonly bank: SampleBank;
  private noise?: AudioBuffer;
  private impulseResponse?: AudioBuffer;

  constructor(private readonly ctx: BaseAudioContext) {
    this.bank = new SampleBank(ctx);
  }

  /** Loads `dance`'s instruments; resolves once they're in. */
  prepare(dance: Dance): Promise<void> {
    return this.bank.prepare(dance);
  }

  ready(dance: Dance): boolean {
    return this.bank.ready(dance);
  }

  /** A mixer for one run, into `destination`. */
  channel(destination: AudioNode): Channel {
    return new Channel(this.ctx, destination, this.impulse());
  }

  /**
   * Everything that sounds on count `index` (0–7) of the `cycle`th
   * eight-count, starting at `t`, a beat being `beat` seconds long.
   */
  play(dance: Dance, index: number, cycle: number, t: number, beat: number, ch: Channel): void {
    ch.tempo(beat, t);
    const at = place(dance, cycle);
    const half = index < 4 ? 0 : 1;
    const bar = at.phrase * 2 + half;
    const chords = PROGRESSION[dance];
    const chord = chords[bar];
    const next = chords[(bar + 1) % 4];
    const eighth = beat / 2;
    // Counts 7 and 8 of a turn's last eight-count belong to the fill.
    const filling = at.fill && index >= 6;

    for (const k of [0, 1]) {
      const e = (index % 4) * 2 + k;
      const when = t + k * eighth;
      if (dance === 'salsa') this.salsa(at.section, e, half, bar, when, eighth, chord, next, filling, ch);
      else this.bachata(at.section, e, bar, when, eighth, chord, next, filling, ch);
    }
    if (filling && index === 6) this.fill(dance, t, beat, ch);
  }

  /** The metronome alone: a woodblock on steps (brighter on the 1), a scrape on taps, a tick on pauses. */
  click(kind: 'step' | 'pause' | 'tap', isOne: boolean, t: number, ch: Channel): void {
    const out = ch.strip('click');
    if (kind === 'tap') {
      this.scrape(t, out);
      return;
    }
    const pitch = kind === 'pause' ? 440 : isOne ? 1320 : 920;
    const level = kind === 'pause' ? 0.05 : 0.32;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, t);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.62, t + 0.08);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  // ---------- the two bands ----------

  private salsa(
    section: Section,
    e: number,
    half: number,
    bar: number,
    at: number,
    eighth: number,
    chord: Chord,
    next: Chord,
    filling: boolean,
    ch: Channel,
  ): void {
    const intro = section === 'intro';
    const chorus = section === 'chorus';
    const drumsFree = !filling || e < 4;

    if (CLAVE[half].includes(e)) this.drum('clave', 0.36, at, ch.strip('clave'));

    // Güiro: a long scrape on each beat, a short one on its "and".
    this.drum(e % 2 ? 'guiro-short' : 'guiro-long', (e % 2 ? 0.1 : 0.16) * (intro ? 0.7 : 1), at, ch.strip('guiro'));

    if (!intro && drumsFree) {
      // Conga tumbao: heel and tip in between, the slap on 2, the open tones on 4 and its "and".
      const conga = ch.strip('conga');
      if (e === 2) this.drum('conga-slap', 0.42, at, conga);
      else if (e === 6) this.drum(half ? 'conga-open-2' : 'conga-open-1', 0.46, at, conga);
      else if (e === 7) this.drum(half ? 'tumba-open-2' : 'tumba-open-1', 0.52, at, conga);
      else this.drum('conga-ghost', e % 2 ? 0.1 : 0.16, at, conga);

      if (chorus) {
        // The bongocero on the bell for the horns: open on 1 and 3, the heel in between.
        if (e === 0 || e === 4) this.drum('bell-open', e === 0 ? 0.34 : 0.28, at, ch.strip('bell'));
        else if (e !== 1 && e !== 5) this.drum('bell-mute', 0.2, at, ch.strip('bell'));
      } else {
        // Bongó martillo: every eighth, the low drum open on 4.
        const bongo = ch.strip('bongo');
        if (e === 6) this.drum('bongo-lo', 0.36, at, bongo);
        else if (e % 2) this.drum('bongo-hi-mute', 0.18, at, bongo);
        else this.drum(e % 4 ? 'bongo-hi-2' : 'bongo-hi-1', e === 0 ? 0.32 : 0.24, at, bongo);
        // Maracas.
        this.drum(e % 2 ? 'shaker-up' : 'shaker-down', e % 2 ? 0.08 : 0.11, at, ch.strip('shaker'));
      }
    }

    // Tumbao bass, from the intro's second bar: the fifth on 2-and, the next root early, on 4.
    if (!intro || half) {
      if (e === 3) this.note('bass', chord.bass + 7, 0.4, at, eighth * 3, ch.strip('bass'));
      if (e === 6) this.note('bass', next.bass, 0.44, at, eighth * 5, ch.strip('bass'));
    }

    // Piano montuno, in octaves.
    const tone = MONTUNO[half][e];
    if (tone !== undefined) {
      const low = this.tone(chord, tone);
      this.note('piano', low, 0.19, at, eighth * 1.6, ch.strip('piano'));
      this.note('piano', low + 12, 0.15, at, eighth * 1.6, ch.strip('piano'));
    }

    if (!chorus) return;

    // The mambo: trumpets on the hook in two parts, trombones pushing the bass line.
    for (const [start, note, length] of HOOK.salsa[bar]) {
      if (start !== e) continue;
      const hold = eighth * (length === 1 ? 0.7 : length * 0.9);
      this.note('trumpet', note, 0.32, at, hold, ch.strip('trumpet'));
      this.note('trumpet', this.below(note, chord), 0.23, at, hold, ch.strip('trumpet2'));
    }
    if (e === 3) this.note('trombone', chord.bass + 19, 0.55, at, eighth * 0.8, ch.strip('trombone'));
    if (e === 6) this.note('trombone', next.bass + 12, 0.6, at, eighth * 1.6, ch.strip('trombone'));
  }

  private bachata(
    section: Section,
    e: number,
    bar: number,
    at: number,
    eighth: number,
    chord: Chord,
    next: Chord,
    filling: boolean,
    ch: Channel,
  ): void {
    const intro = section === 'intro';
    const drumsFree = !filling || e < 4;

    // Güira: a long stroke on each beat, a short one on its "and".
    this.drum(e % 2 ? 'cabasa-hit' : 'cabasa-rub', (e % 2 ? 0.18 : 0.26) * (intro ? 0.6 : 1), at, ch.strip('guira'));

    // The intro is the requinto alone over the güira; the band comes in after its fill.
    if (!intro) {
      if (drumsFree) {
        // Bongó martillo, opening up on 4 — the beat the dancers tap.
        const bongo = ch.strip('bongo');
        if (e === 6) this.drum('bongo-hi-accent', 0.48, at, bongo);
        else if (e === 7) this.drum('bongo-lo-mute', 0.2, at, bongo);
        else if (e % 2) this.drum('bongo-hi-mute', 0.18, at, bongo);
        else this.drum(e % 4 ? 'bongo-hi-2' : 'bongo-hi-1', e === 0 ? 0.32 : 0.24, at, bongo);
      }

      // Bass: root, the fifth on 2-and, root again on 3, a half step up into the next chord.
      const bass = ch.strip('bass');
      if (e === 0) this.note('bass', chord.bass, 0.43, at, eighth * 3, bass);
      if (e === 3) this.note('bass', chord.bass + 7, 0.33, at, eighth, bass);
      if (e === 4) this.note('bass', chord.bass, 0.38, at, eighth * 3, bass);
      if (e === 7) this.note('bass', next.bass - 1, 0.33, at, eighth, bass);

      // Segunda: the chord strummed on 1 and 3, a muted chuck on 2-and and 4-and.
      if (e === 0 || e === 4) this.strum(chord, 0.2, at, eighth * 3, ch.strip('acoustic'));
      if (e === 3 || e === 7) this.strum(chord, 0.12, at, eighth * 0.35, ch.strip('acoustic'));
    }

    const guitar = ch.strip('guitar');

    // Requinto runs: the whole bar in the intro, answering in the second half of each verse bar.
    if (intro || (section === 'verse' && e >= 4)) {
      for (const s of [0, 1]) {
        const note = this.tone(chord, RUN[e * 2 + s]);
        this.note('guitar', note, s ? 0.22 : 0.3, at + (s * eighth) / 2, eighth * 1.4, guitar);
      }
    }

    // The hook, on the requinto in thirds.
    if (section !== 'chorus') return;
    for (const [start, note, length] of HOOK.bachata[bar]) {
      if (start !== e) continue;
      this.note('guitar', note, 0.46, at, eighth * length, guitar);
      this.note('guitar', this.below(note, chord), 0.32, at + 0.008, eighth * length, guitar);
    }
  }

  /** Two counts of sixteenths, rising: congas into the salsa's next turn, the bongó's repique into the bachata's. */
  private fill(dance: Dance, t: number, beat: number, ch: Channel): void {
    const strokes: readonly Drum[] =
      dance === 'salsa'
        ? ['conga-slap', 'conga-open-1', 'conga-open-2', 'tumba-open-1']
        : ['bongo-hi-1', 'bongo-hi-2', 'bongo-hi-mute', 'bongo-lo'];
    const out = ch.strip(dance === 'salsa' ? 'conga' : 'bongo');
    for (let i = 0; i < 8; i++) this.drum(strokes[i % 4], 0.2 + i * 0.045, t + (i * beat) / 4, out);
  }

  private tone(chord: Chord, index: number): number {
    const { tones } = chord;
    return chord.root + tones[index % tones.length] + 12 * Math.floor(index / tones.length);
  }

  /** The chord tone closest below `note`, at least a minor third down: the next voice down in a harmony. */
  private below(note: number, chord: Chord): number {
    for (let n = note - 3; n > note - 12; n--) {
      if (chord.tones.some((i) => (((n - chord.root - i) % 12) + 12) % 12 === 0)) return n;
    }
    return note - 12;
  }

  /** The segunda's strum: the chord's three tones between E3 and G4, a few milliseconds apart. */
  private strum(chord: Chord, level: number, t: number, length: number, out: AudioNode): void {
    [0, 1, 2].forEach((i) => {
      let n = chord.root + chord.tones[i];
      while (n > 67) n -= 12;
      while (n < 52) n += 12;
      this.note('acoustic', n, level, t + i * 0.012, length, out);
    });
  }

  // ---------- playing the samples ----------

  /** A hand-played stroke: a touch off the grid, a touch louder or softer each time. */
  private drum(name: Drum, level: number, t: number, out: AudioNode): void {
    const sample = this.bank.drum(name);
    if (sample) this.voice(sample, 1, level * (0.9 + Math.random() * 0.2), t + Math.random() * 0.004, out);
  }

  /** A pitched note, from the instrument's nearest sample, cut after `length`. */
  private note(instrument: Instrument, midi: number, level: number, t: number, length: number, out: AudioNode): void {
    const found = this.bank.note(instrument, midi);
    if (found) this.voice(found.sample, found.rate, level, t, out, length);
  }

  private voice(sample: Sample, rate: number, level: number, t: number, out: AudioNode, length?: number): void {
    const { ctx } = this;
    const src = ctx.createBufferSource();
    src.buffer = sample.buffer;
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level * sample.gain, t);
    src.connect(gain).connect(out);
    src.start(t, sample.offset);
    if (length !== undefined) {
      gain.gain.setTargetAtTime(0.0001, t + length, 0.035);
      src.stop(t + length + 0.25);
    }
  }

  // ---------- synthesised: the metronome's tap, the room ----------

  /** The metronome's tap: a short burst of bright noise, scraped. */
  private scrape(t: number, out: AudioNode): void {
    const { ctx } = this;
    const src = ctx.createBufferSource();
    src.buffer = this.whiteNoise();
    const band = ctx.createBiquadFilter();
    band.type = 'highpass';
    band.frequency.value = 6500;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    src.connect(band).connect(gain).connect(out);
    src.start(t, Math.random() * 0.5, 0.16);
  }

  private whiteNoise(): AudioBuffer {
    if (!this.noise) {
      const { ctx } = this;
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const y = this.noise.getChannelData(0);
      for (let i = 0; i < y.length; i++) y[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }

  /**
   * The room's impulse response, made rather than recorded: two seconds of
   * stereo noise dying away and darkening as it goes.
   */
  private impulse(): AudioBuffer {
    if (!this.impulseResponse) {
      const { ctx } = this;
      const n = Math.round(ctx.sampleRate * 2.2);
      const ir = ctx.createBuffer(2, n, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const y = ir.getChannelData(c);
        let smooth = 0;
        for (let i = 0; i < n; i++) {
          const p = i / n;
          smooth += (0.9 - 0.75 * p) * (Math.random() * 2 - 1 - smooth);
          y[i] = smooth * (1 - p) ** 2.6;
        }
      }
      this.impulseResponse = ir;
    }
    return this.impulseResponse;
  }
}
