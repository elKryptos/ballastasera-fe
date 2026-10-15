import { Card } from './cards';

/** A reel: a deck's pictures played one after the other and recorded as a
 * video, here in the browser — each held long enough to be read, pushed in
 * from the right like a swipe, and drifting slowly closer so the frame is
 * never still. Silent: the music is added in Instagram, from its library. */

/** Seconds a card stays on screen, by how much there is to read on it. */
export function cardSeconds(card: Card): number {
  switch (card.kind) {
    case 'cover':
      return 2.6;
    case 'night':
      return 1.6 + card.rows.length * 0.9;
    case 'event':
      return 4.5;
    case 'point':
      return card.title ? 4.5 : 3.6;
    case 'versus':
      return 4;
    case 'outro':
      return 3.2;
  }
}

/** What Instagram takes as a reel. Past it the video has to be cut down. */
export const MAX_REEL_SECONDS = 90;

const FPS = 30;
/** A new card takes this long to push the last one out. */
const SWIPE_SECONDS = 0.45;
/** How much closer a card gets while it's on screen. */
const DRIFT = 0.035;

/** The video formats Instagram accepts first (MP4), then what's left to a
 * browser that can't record those. */
const TYPES = [
  { mime: 'video/mp4;codecs=avc1.640028', extension: 'mp4' },
  { mime: 'video/mp4;codecs=avc1.42E01E', extension: 'mp4' },
  { mime: 'video/mp4', extension: 'mp4' },
  { mime: 'video/webm;codecs=vp9', extension: 'webm' },
  { mime: 'video/webm', extension: 'webm' },
] as const;

/** What this browser records a reel as; null when it can't record at all.
 * A 'webm' isn't something Instagram takes: it has to be converted first. */
export function reelType(): (typeof TYPES)[number] | null {
  if (typeof MediaRecorder === 'undefined' || !('captureStream' in HTMLCanvasElement.prototype)) return null;
  return TYPES.find((type) => MediaRecorder.isTypeSupported(type.mime)) ?? null;
}

const easeOut = (t: number): number => 1 - (1 - t) ** 3;

/**
 * Plays `frames` (the cards, drawn, all the same size) for `seconds` each
 * and resolves with the recording. It runs in real time — a 20 second reel
 * takes 20 seconds — and on the page's own frames, so the tab has to stay in
 * view: a hidden tab's frames are held back, and the video with them.
 * `progress` gets how far along it is, 0 to 1.
 */
export function recordReel(
  frames: HTMLCanvasElement[],
  seconds: number[],
  type: { mime: string },
  progress: (done: number) => void,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const { width, height } = frames[0];
    const stage = document.createElement('canvas');
    stage.width = width;
    stage.height = height;
    const ctx = stage.getContext('2d')!;

    const starts: number[] = [];
    let total = 0;
    for (const length of seconds) {
      starts.push(total);
      total += length;
    }

    /** Frame `index`, `into` seconds into its time, its left edge at `x`. */
    const place = (index: number, into: number, x: number): void => {
      const zoom = 1 + DRIFT * Math.min(1, into / seconds[index]);
      ctx.drawImage(frames[index], x - (width * (zoom - 1)) / 2, -(height * (zoom - 1)) / 2, width * zoom, height * zoom);
    };
    const draw = (time: number): void => {
      let index = starts.length - 1;
      while (index > 0 && starts[index] > time) index--;
      const into = time - starts[index];
      if (index > 0 && into < SWIPE_SECONDS) {
        // The last card, as it was when its time ran out, under the new one.
        const pushed = easeOut(into / SWIPE_SECONDS) * width;
        place(index - 1, seconds[index - 1], -pushed);
        place(index, into, width - pushed);
      } else {
        place(index, into, 0);
      }
    };

    const recorder = new MediaRecorder(stage.captureStream(FPS), { mimeType: type.mime, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onerror = () => reject(new Error('recording failed'));
    recorder.onstop = () => resolve(new Blob(chunks, { type: type.mime.split(';')[0] }));

    draw(0);
    recorder.start();
    const began = performance.now();
    const tick = (): void => {
      const time = (performance.now() - began) / 1000;
      draw(Math.min(time, total));
      progress(Math.min(1, time / total));
      // A moment past the end, so the last card's frames are all in.
      if (time < total + 0.25) requestAnimationFrame(tick);
      else recorder.stop();
    };
    requestAnimationFrame(tick);
  });
}
