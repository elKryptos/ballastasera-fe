/** The brand drawn on a canvas, for the pictures the app makes to be shared: the admin's Instagram
 * posts (features/admin/social-posts) and a dancer's profile card for the stories. */

/** The app's two families, as styles.css loads them, each with a fallback. */
export const DISPLAY_FONT = '"Bricolage Grotesque", "Arial Black", sans-serif';
export const BODY_FONT = '"Instrument Sans", system-ui, sans-serif';

type Ctx = CanvasRenderingContext2D;

// The brand's mark, as in the navbar: a map pin holding three equaliser bars. Drawn in a 200×210
// box, the pin itself from (48, 28).
const MARK_PIN = 'M100,182 C78,140 48,116 48,80 A52 52 0 1 1 152,80 C152,116 122,140 100,182 Z';
const MARK_BARS = [
  [74, 66, 13, 30],
  [93, 54, 13, 54],
  [112, 62, 13, 38],
] as const;
export const MARK_WIDTH = 104;
export const MARK_HEIGHT = 154;

/** The pin's fill and its bars'. */
export interface MarkColors {
  pin: string | CanvasGradient;
  bars: string;
}

/** The mark `height` px tall, its top left at (x, y). */
export function drawMark(ctx: Ctx, x: number, y: number, height: number, colors: MarkColors): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(height / MARK_HEIGHT, height / MARK_HEIGHT);
  ctx.translate(-48, -28);
  ctx.fillStyle = colors.pin;
  ctx.fill(new Path2D(MARK_PIN));
  ctx.fillStyle = colors.bars;
  for (const [barX, barY, barWidth, barHeight] of MARK_BARS) {
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, barWidth / 2);
    ctx.fill();
  }
  ctx.restore();
}

/** "balla" then, in the accent, "stasera", starting at x on the baseline y, `size` px; returns how
 * wide it was. */
export function drawWordmark(ctx: Ctx, x: number, y: number, size: number, colors: { text: string; accent: string }): number {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${size}px ${DISPLAY_FONT}`;
  ctx.fillStyle = colors.text;
  ctx.fillText('balla', x, y);
  const balla = ctx.measureText('balla').width;
  ctx.fillStyle = colors.accent;
  ctx.fillText('stasera', x + balla, y);
  return balla + ctx.measureText('stasera').width;
}
