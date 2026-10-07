import type { Dance } from './lesson';

/**
 * The lesson band's recorded instruments, served from /lesson-audio (see
 * CREDITS.txt there): percussion and piano from the VCSL (CC0); bass,
 * trumpet, trombone and guitars from tonejs-instruments (CC BY 3.0). Each
 * file is a single note or stroke, trimmed and normalised; the band plays
 * them like a sampler, so the music stays in time with the feet at any
 * tempo.
 */
const BASE = '/lesson-audio/';

/** Pitched instruments: the MIDI note each sample was recorded at, and its file. */
const PITCHED = {
  piano: { 50: 'piano-D3', 52: 'piano-E3', 54: 'piano-Fs3', 56: 'piano-Gs3', 58: 'piano-As3', 60: 'piano-C4', 62: 'piano-D4', 64: 'piano-E4', 66: 'piano-Fs4', 68: 'piano-Gs4', 70: 'piano-As4', 72: 'piano-C5', 74: 'piano-D5', 76: 'piano-E5', 78: 'piano-Fs5', 80: 'piano-Gs5', 82: 'piano-As5' },
  bass: { 34: 'bass-As1', 37: 'bass-Cs2', 40: 'bass-E2', 43: 'bass-G2', 46: 'bass-As2', 49: 'bass-Cs3', 52: 'bass-E3' },
  trumpet: { 60: 'trumpet-C4', 63: 'trumpet-Ds4', 65: 'trumpet-F4', 67: 'trumpet-G4', 70: 'trumpet-As4', 74: 'trumpet-D5', 77: 'trumpet-F5', 81: 'trumpet-A5', 84: 'trumpet-C6' },
  trombone: { 48: 'trombone-C3', 51: 'trombone-Ds3', 53: 'trombone-F3', 56: 'trombone-Gs3', 58: 'trombone-As3', 60: 'trombone-C4' },
  guitar: { 60: 'guitar-C4', 63: 'guitar-Ds4', 66: 'guitar-Fs4', 69: 'guitar-A4', 72: 'guitar-C5', 75: 'guitar-Ds5', 78: 'guitar-Fs5', 81: 'guitar-A5', 84: 'guitar-C6' },
  acoustic: { 52: 'acoustic-E3', 55: 'acoustic-G3', 58: 'acoustic-As3', 61: 'acoustic-Cs4', 64: 'acoustic-E4', 67: 'acoustic-G4' },
} as const satisfies Record<string, Record<number, string>>;

export type Instrument = keyof typeof PITCHED;

const SALSA_DRUMS = [
  'conga-open-1', 'conga-open-2', 'conga-slap', 'conga-ghost', 'tumba-open-1', 'tumba-open-2',
  'bongo-hi-1', 'bongo-hi-2', 'bongo-hi-mute', 'bongo-lo', 'bongo-lo-mute',
  'bell-open', 'bell-mute', 'clave', 'guiro-long', 'guiro-short', 'shaker-down', 'shaker-up',
] as const;

const BACHATA_DRUMS = [
  'bongo-hi-1', 'bongo-hi-2', 'bongo-hi-accent', 'bongo-hi-mute', 'bongo-lo', 'bongo-lo-mute', 'cabasa-hit', 'cabasa-rub',
] as const;

export type Drum = (typeof SALSA_DRUMS)[number] | (typeof BACHATA_DRUMS)[number];

/** What each dance's band needs loaded before it plays. */
const KIT: Record<Dance, { instruments: readonly Instrument[]; drums: readonly Drum[] }> = {
  salsa: { instruments: ['piano', 'bass', 'trumpet', 'trombone'], drums: SALSA_DRUMS },
  bachata: { instruments: ['guitar', 'acoustic', 'bass'], drums: BACHATA_DRUMS },
};

/** A decoded sample, with where its sound actually starts and the gain that brings its peak to 0.9. */
export interface Sample {
  buffer: AudioBuffer;
  offset: number;
  gain: number;
}

/**
 * Loads and holds the band's samples, a dance's kit at a time, on first
 * play. Sound starts at each sample's measured onset, so whatever silence
 * the MP3 decoder pads in front can't push a stroke off the beat.
 */
export class SampleBank {
  private readonly loading = new Map<string, Promise<Sample | null>>();
  private readonly samples = new Map<string, Sample>();
  private readonly kits = new Map<Dance, Promise<void>>();
  private readonly loaded = new Set<Dance>();

  constructor(private readonly ctx: BaseAudioContext) {}

  /** Loads `dance`'s kit; resolves when all of it is in (a sample that fails is simply left out). */
  prepare(dance: Dance): Promise<void> {
    let kit = this.kits.get(dance);
    if (!kit) {
      const { instruments, drums } = KIT[dance];
      const names = [...drums, ...instruments.flatMap((i) => Object.values(PITCHED[i]) as string[])];
      kit = Promise.all(names.map((name) => this.load(name))).then(() => {
        this.loaded.add(dance);
      });
      this.kits.set(dance, kit);
    }
    return kit;
  }

  ready(dance: Dance): boolean {
    return this.loaded.has(dance);
  }

  drum(name: Drum): Sample | undefined {
    return this.samples.get(name);
  }

  /** The sample closest to `midi` and the playback rate that tunes it there. */
  note(instrument: Instrument, midi: number): { sample: Sample; rate: number } | undefined {
    const roots = Object.keys(PITCHED[instrument]).map(Number);
    const root = roots.reduce((best, r) => (Math.abs(r - midi) < Math.abs(best - midi) ? r : best));
    const sample = this.samples.get((PITCHED[instrument] as Record<number, string>)[root]);
    return sample && { sample, rate: 2 ** ((midi - root) / 12) };
  }

  private load(name: string): Promise<Sample | null> {
    let pending = this.loading.get(name);
    if (!pending) {
      pending = fetch(`${BASE}${name}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${name}: ${r.status}`))))
        .then((data) => this.ctx.decodeAudioData(data))
        .then((buffer) => {
          const y = buffer.getChannelData(0);
          let peak = 0;
          for (let i = 0; i < y.length; i++) peak = Math.max(peak, Math.abs(y[i]));
          let onset = 0;
          while (onset < y.length && Math.abs(y[onset]) < peak * 0.02) onset++;
          const sample: Sample = {
            buffer,
            offset: Math.max(0, onset - Math.round(buffer.sampleRate * 0.001)) / buffer.sampleRate,
            gain: peak > 0 ? 0.9 / peak : 1,
          };
          this.samples.set(name, sample);
          return sample;
        })
        .catch(() => null);
      this.loading.set(name, pending);
    }
    return pending;
  }
}
