/** The picture "Condividi" makes of a dancer's profile, for the Instagram stories (canvas 4's
 * "Condividi il tuo profilo"): the brand, the face (or the initial on its colour), the name, role and
 * city, the styles at their level and the link to the profile. Drawn on a canvas, always in the dark
 * look; no Angular in here: ShareSheet owns the canvas, the photo and the share. */

import { BODY_FONT, DISPLAY_FONT, MARK_HEIGHT, MARK_WIDTH, drawMark, drawWordmark } from '../../../core/utils/brand-canvas';

/** A story's frame. Instagram's own buttons cover about the top 250 and the bottom 330: nothing
 * that matters is drawn there. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

/** The fonts drawProfileCard uses, for document.fonts.load before drawing. */
export const PROFILE_CARD_FONTS = [`800 40px ${DISPLAY_FONT}`, `500 40px ${BODY_FONT}`, `800 40px ${BODY_FONT}`];

/** The app's dark colours (styles.css), and the dance levels' (--ev-level-N). */
const GROUND = '#0f0d0e';
const RINGS = ['#2b1e25', '#241b20', '#1e171b'];
const BONE = '#f5eeea';
const SOFT = '#c2b8b4';
const MUTED = '#b0a6a2';
const ROSE = '#ff4f7b';
const ROSE_LINK = '#ff7a9c';
const INK = '#1b1819';
export const LEVEL_COLORS = ['#4ade80', '#9be15d', '#f5c04a', '#ffa62b'];

export interface ProfileCardStyle {
  /** "Salsa · Avanzato". */
  label: string;
  /** Its level's colour (LEVEL_COLORS). */
  color: string;
}

export interface ProfileCardData {
  name: string;
  initial: string;
  /** The person's colour behind the initial, and the initial's. */
  tone: { bg: string; fg: string };
  /** "Leader · Milano", or empty. */
  line: string;
  styles: ProfileCardStyle[];
  /** "ballastasera.it/@kryptos". */
  link: string;
}

type Ctx = CanvasRenderingContext2D;

const CENTER = CARD_WIDTH / 2;
const AVATAR_Y = 720;
const AVATAR_RADIUS = 220;

/** Draws the whole card; `photo` null draws the initial instead. */
export function drawProfileCard(ctx: Ctx, data: ProfileCardData, photo: CanvasImageSource | null): void {
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  drawRings(ctx);
  drawLockup(ctx, 330);
  drawAvatar(ctx, data, photo);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = BONE;
  ctx.font = fitted(ctx, data.name, `800 {size}px ${DISPLAY_FONT}`, 100, CARD_WIDTH - 160);
  ctx.fillText(data.name, CENTER, AVATAR_Y + AVATAR_RADIUS + 150);

  let y = AVATAR_Y + AVATAR_RADIUS + 225;
  if (data.line) {
    ctx.fillStyle = SOFT;
    ctx.font = fitted(ctx, data.line, `500 {size}px ${BODY_FONT}`, 46, CARD_WIDTH - 160);
    ctx.fillText(data.line, CENTER, y);
    y += 70;
  }
  drawStyles(ctx, data.styles, y);

  ctx.textAlign = 'center';
  ctx.fillStyle = MUTED;
  ctx.font = `500 40px ${BODY_FONT}`;
  ctx.fillText('Ci vediamo in pista', CENTER, 1500);
  ctx.fillStyle = ROSE_LINK;
  ctx.font = fitted(ctx, data.link, `800 {size}px ${BODY_FONT}`, 54, CARD_WIDTH - 160);
  ctx.fillText(data.link, CENTER, 1575);
}

/** Rings round the face, as on the profile's band. */
function drawRings(ctx: Ctx): void {
  ctx.lineWidth = 6;
  [360, 500, 640].forEach((radius, index) => {
    ctx.strokeStyle = RINGS[index];
    ctx.beginPath();
    ctx.arc(CENTER, AVATAR_Y, radius, 0, Math.PI * 2);
    ctx.stroke();
  });
}

/** The mark and the wordmark, centred, the wordmark's baseline at y. */
function drawLockup(ctx: Ctx, y: number): void {
  const size = 92;
  const markHeight = 128;
  const markWidth = (markHeight * MARK_WIDTH) / MARK_HEIGHT;
  const gap = 24;
  ctx.font = `800 ${size}px ${DISPLAY_FONT}`;
  const textWidth = ctx.measureText('ballastasera').width;
  const left = CENTER - (markWidth + gap + textWidth) / 2;
  drawMark(ctx, left, y - markHeight + 18, markHeight, { pin: ROSE, bars: INK });
  drawWordmark(ctx, left + markWidth + gap, y, size, { text: BONE, accent: ROSE });
}

function drawAvatar(ctx: Ctx, data: ProfileCardData, photo: CanvasImageSource | null): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(CENTER, AVATAR_Y, AVATAR_RADIUS, 0, Math.PI * 2);
  ctx.clip();
  if (photo) {
    drawCovering(ctx, photo, CENTER - AVATAR_RADIUS, AVATAR_Y - AVATAR_RADIUS, AVATAR_RADIUS * 2);
  } else {
    ctx.fillStyle = data.tone.bg;
    ctx.fillRect(CENTER - AVATAR_RADIUS, AVATAR_Y - AVATAR_RADIUS, AVATAR_RADIUS * 2, AVATAR_RADIUS * 2);
    ctx.fillStyle = data.tone.fg;
    ctx.font = `800 ${AVATAR_RADIUS}px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.initial, CENTER, AVATAR_Y + AVATAR_RADIUS * 0.06);
  }
  ctx.restore();
  ctx.lineWidth = 16;
  ctx.strokeStyle = ROSE;
  ctx.beginPath();
  ctx.arc(CENTER, AVATAR_Y, AVATAR_RADIUS + 8, 0, Math.PI * 2);
  ctx.stroke();
}

/** A square photo's centre, covering a `size` square at (x, y). */
function drawCovering(ctx: Ctx, image: CanvasImageSource, x: number, y: number, size: number): void {
  const { width, height } = image as { width: number; height: number };
  const side = Math.min(width, height);
  ctx.drawImage(image, (width - side) / 2, (height - side) / 2, side, side, x, y, size, size);
}

/** The styles as chips in their level's colour, centred, wrapping to a second row (no more). */
function drawStyles(ctx: Ctx, styles: ProfileCardStyle[], top: number): void {
  const height = 80;
  const gap = 18;
  const padding = 30;
  const maxWidth = CARD_WIDTH - 160;
  ctx.font = `800 38px ${BODY_FONT}`;
  const rows: { style: ProfileCardStyle; width: number }[][] = [[]];
  let rowWidth = 0;
  for (const style of styles) {
    const width = ctx.measureText(style.label).width + padding * 2;
    if (rowWidth + width > maxWidth && rows[rows.length - 1].length) {
      if (rows.length === 2) break;
      rows.push([]);
      rowWidth = 0;
    }
    rows[rows.length - 1].push({ style, width });
    rowWidth += width + gap;
  }
  rows.forEach((row, index) => {
    const total = row.reduce((sum, chip) => sum + chip.width, 0) + gap * (row.length - 1);
    let x = CENTER - total / 2;
    const y = top + index * (height + gap);
    for (const { style, width } of row) {
      ctx.fillStyle = `${style.color}29`;
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, 22);
      ctx.fill();
      ctx.fillStyle = style.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(style.label, x + width / 2, y + height / 2 + 2);
      x += width + gap;
    }
  });
}

/** The font (a template with {size}) at `size`, or smaller until `text` fits `maxWidth`. */
function fitted(ctx: Ctx, text: string, font: string, size: number, maxWidth: number): string {
  let current = size;
  ctx.font = font.replace('{size}', String(current));
  while (current > 24 && ctx.measureText(text).width > maxWidth) {
    current -= 4;
    ctx.font = font.replace('{size}', String(current));
  }
  return ctx.font;
}
