/** The pictures an Instagram post is made of, drawn on a canvas: what a card
 * can be (Card), and how each kind is drawn (drawCard). No Angular and no
 * data in here: the decks are built in agenda-decks.ts and lesson-decks.ts,
 * and SocialPosts owns the canvases, the flyers and the downloads. */

/** A post's picture (4:5, the tallest a carousel shows whole) or a story's. */
export type Format = 'post' | 'story';

interface Frame {
  width: number;
  height: number;
  /** The wordmark's baseline, and the footer's: everything else sits between. */
  top: number;
  bottom: number;
}

/** A story keeps clear of its top and bottom, where Instagram draws its own
 * buttons over the picture. */
export const FRAMES: Record<Format, Frame> = {
  post: { width: 1080, height: 1350, top: 124, bottom: 1284 },
  story: { width: 1080, height: 1920, top: 330, bottom: 1570 },
};

/** What Instagram takes in one carousel. */
export const MAX_CAROUSEL_CARDS = 20;

/** One event on a night's card. */
export interface NightRow {
  time: string;
  title: string;
  /** The venue, or the organizer where there's none. */
  place: string;
  styles: string;
  price: string;
  flyerUrl: string | null;
}

export type Card =
  /** A carousel's first card: the question or the title, `flair` in rose. */
  | { kind: 'cover'; kicker: string | null; title: string; flair: string; sub: string; accent: string | null; note: string }
  /** A night's events, at most MAX_ROWS of them. */
  | { kind: 'night'; heading: string; sub: string; rows: NightRow[] }
  /** One thing to know: with a `title` the copy is the smaller text under it,
   * without one it's the card's own headline. */
  | { kind: 'point'; label: string; title: string | null; copy: string }
  /** A mistake, struck out, and what to do instead. */
  | { kind: 'versus'; label: string; wrong: string; right: string }
  /** A carousel's last card: where to find the rest. */
  | { kind: 'outro'; title: string; flair: string; note: string };

/** The most rows a night's card takes. */
export const MAX_ROWS = 5;

// The brand's night colours (styles.css @theme): a post is always the dark
// look, whatever theme the admin has on.
const INK = '#1a0e2e';
const INK_2 = '#2a1640';
const ROSE = '#ff4d6d';
const ROSE_LIT = '#ff6e88';
const VIOLET = '#8b5cf6';
const MINT = '#2dd4bf';
const PRICE = '#fbbf24';
const BONE = '#fdf2ec';
const LEAD = '#ead6dc';
const MUTED = '#c2a0ae';
const LINE = 'rgba(253, 242, 236, 0.14)';

const DISPLAY = '"Bricolage Grotesque", "Arial Black", sans-serif';
const BODY = '"Instrument Sans", system-ui, sans-serif';

/** Every font drawCard uses, for document.fonts.load: a canvas draws with a
 * fallback, and never again, if the web font isn't in yet. */
export const CARD_FONTS = [`800 40px ${DISPLAY}`, `600 40px ${BODY}`, `400 40px ${BODY}`];

const PAD = 84;

type Ctx = CanvasRenderingContext2D;
type Flyers = ReadonlyMap<string, CanvasImageSource | null>;

/** Draws `card`, the `index`-th of `total`. `flyers` holds what's loaded of
 * a night's flyers, by URL; a row without one gets its title's initial. */
export function drawCard(ctx: Ctx, format: Format, card: Card, index: number, total: number, flyers: Flyers): void {
  const frame = FRAMES[format];
  drawBackdrop(ctx, frame);
  drawBrand(ctx, frame);
  drawFooter(ctx, frame, index, total);
  switch (card.kind) {
    case 'cover':
      drawStack(ctx, frame, [
        ...(card.kicker ? [body(card.kicker.toUpperCase(), 600, 34, MINT, 0)] : []),
        headline(card.title, 150, BONE, card.kicker ? 30 : 0),
        headline(card.flair, 150, ROSE, 0),
        body(card.sub, 600, 54, LEAD, 44),
        ...(card.accent ? [body(card.accent, 600, 46, MINT, 26)] : []),
        body(card.note, 600, 40, BONE, 110),
      ]);
      return;
    case 'night':
      drawNight(ctx, frame, card, flyers);
      return;
    case 'point':
      drawStack(ctx, frame, [
        body(card.label.toUpperCase(), 600, 36, MINT, 0),
        ...(card.title
          ? [display(card.title, 104, BONE, 26), body(card.copy, 400, 54, LEAD, 44)]
          : [display(card.copy, 82, BONE, 34)]),
      ]);
      return;
    case 'versus':
      drawStack(ctx, frame, [
        body(card.label.toUpperCase(), 600, 36, ROSE_LIT, 0),
        { ...display(card.wrong, 96, MUTED, 26), struck: true },
        body('MEGLIO COSÌ', 600, 36, MINT, 90),
        display(card.right, 76, BONE, 26),
      ]);
      return;
    case 'outro':
      drawStack(ctx, frame, [
        headline(card.title, 124, BONE, 0),
        headline(card.flair, 124, BONE, 0),
        headline('ballastasera.it', 150, ROSE, 60),
        body('Link in bio', 600, 52, LEAD, 30),
        body(card.note, 400, 40, MUTED, 110),
      ]);
      return;
  }
}

function drawBackdrop(ctx: Ctx, { width, height }: Frame): void {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, INK_2);
  sky.addColorStop(1, INK);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  for (const [x, y, radius, colour, alpha] of [
    [width, 0, 760, ROSE, 0.3],
    [0, height, 700, VIOLET, 0.26],
  ] as const) {
    const light = ctx.createRadialGradient(x, y, 0, x, y, radius);
    light.addColorStop(0, colour);
    light.addColorStop(1, 'transparent');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.globalAlpha = 1;
}

/** The navbar's lockup: the mark, then "balla" and, in rose, "stasera". */
function drawBrand(ctx: Ctx, frame: Frame): void {
  const markHeight = 58;
  drawMark(ctx, PAD, frame.top - markHeight + 10, markHeight);
  const x = PAD + (markHeight * MARK_WIDTH) / MARK_HEIGHT + 14;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 44px ${DISPLAY}`;
  ctx.fillStyle = BONE;
  ctx.fillText('balla', x, frame.top);
  ctx.fillStyle = ROSE;
  ctx.fillText('stasera', x + ctx.measureText('balla').width, frame.top);
}

// The brand's mark, as in the navbar: a map pin holding three equaliser
// bars. Drawn in a 200×210 box, the pin itself from (48, 28).
const MARK_PIN = 'M100,182 C78,140 48,116 48,80 A52 52 0 1 1 152,80 C152,116 122,140 100,182 Z';
const MARK_BARS = [
  [74, 66, 13, 30],
  [93, 54, 13, 54],
  [112, 62, 13, 38],
] as const;
const MARK_WIDTH = 104;
const MARK_HEIGHT = 154;

/** The mark `height` px tall, its top left at (x, y). */
function drawMark(ctx: Ctx, x: number, y: number, height: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(height / MARK_HEIGHT, height / MARK_HEIGHT);
  ctx.translate(-48, -28);
  ctx.fillStyle = ROSE;
  ctx.fill(new Path2D(MARK_PIN));
  ctx.fillStyle = INK;
  for (const [barX, barY, barWidth, barHeight] of MARK_BARS) {
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, barWidth / 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The site and, in a carousel, which card of how many this is. */
function drawFooter(ctx: Ctx, frame: Frame, index: number, total: number): void {
  ctx.font = `600 32px ${BODY}`;
  ctx.fillStyle = LEAD;
  ctx.fillText('ballastasera.it', PAD, frame.bottom);
  if (total > 1) {
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'right';
    ctx.fillText(`${index + 1} / ${total}`, frame.width - PAD, frame.bottom);
    ctx.textAlign = 'left';
  }
}

// --- Cards of text: a stack of blocks, centred between wordmark and footer.

interface Block {
  text: string;
  weight: number;
  family: string;
  size: number;
  colour: string;
  /** Room above it, in px. */
  gap: number;
  /** One line, the font taken down until it fits; otherwise it wraps. */
  fit?: boolean;
  struck?: boolean;
}

const headline = (text: string, size: number, colour: string, gap: number): Block => ({
  ...display(text, size, colour, gap),
  fit: true,
});
const display = (text: string, size: number, colour: string, gap: number): Block => ({
  text,
  weight: 800,
  family: DISPLAY,
  size,
  colour,
  gap,
});
const body = (text: string, weight: number, size: number, colour: string, gap: number): Block => ({
  text,
  weight,
  family: BODY,
  size,
  colour,
  gap,
});

/** Lays the blocks out top to bottom and draws them centred in the frame's
 * free height. Too tall to fit (a long copy), everything shrinks together. */
function drawStack(ctx: Ctx, frame: Frame, blocks: Block[]): void {
  const inner = frame.width - 2 * PAD;
  const room = frame.bottom - frame.top - 190;
  let laid = layOut(ctx, blocks, inner, 1);
  if (laid.height > room) laid = layOut(ctx, blocks, inner, Math.max(0.6, room / laid.height));
  let y = frame.top + 80 + Math.max(0, (room - laid.height) / 2);
  ctx.textBaseline = 'top';
  for (const { block, font, size, lines, lineHeight, gap } of laid.blocks) {
    y += gap;
    ctx.font = font;
    for (const line of lines) {
      ctx.fillStyle = block.colour;
      ctx.fillText(line, PAD, y);
      if (block.struck) {
        // A marker's stroke through the line, slightly off level.
        ctx.strokeStyle = ROSE;
        ctx.lineWidth = size * 0.09;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(PAD - 8, y + size * 0.6);
        ctx.lineTo(PAD + ctx.measureText(line).width + 8, y + size * 0.46);
        ctx.stroke();
      }
      y += lineHeight;
    }
  }
  ctx.textBaseline = 'alphabetic';
}

function layOut(ctx: Ctx, blocks: Block[], width: number, scale: number) {
  let height = 0;
  const laid = blocks.map((block) => {
    let size = Math.round(block.size * scale);
    ctx.font = `${block.weight} ${size}px ${block.family}`;
    let lines = [block.text];
    if (block.fit) {
      const textWidth = ctx.measureText(block.text).width;
      if (textWidth > width) size = Math.floor((size * width) / textWidth);
    } else {
      lines = wrapped(ctx, block.text, width);
    }
    const lineHeight = size * (block.family === DISPLAY ? 1.06 : 1.34);
    const gap = block.gap * scale;
    height += gap + lines.length * lineHeight;
    return { block, font: `${block.weight} ${size}px ${block.family}`, size, lines, lineHeight, gap };
  });
  return { blocks: laid, height };
}

/** `text` in lines no wider than `maxWidth`, in the context's current font. */
function wrapped(ctx: Ctx, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const longer = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(longer).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = longer;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// --- A night's card: its heading, then a row per event.

/** A row at scale 1: MAX_ROWS of them fill a post. */
const ROW_HEIGHT = 154;
const MAX_SCALE = 1.5;

function drawNight(ctx: Ctx, frame: Frame, card: Extract<Card, { kind: 'night' }>, flyers: Flyers): void {
  const inner = frame.width - 2 * PAD;
  ctx.fillStyle = BONE;
  ctx.font = fitted(ctx, card.heading, 800, 124, inner, DISPLAY);
  ctx.fillText(card.heading, PAD, frame.top + 176);
  ctx.fillStyle = ROSE_LIT;
  ctx.font = `600 48px ${BODY}`;
  ctx.fillText(card.sub, PAD, frame.top + 242, inner);

  // The rows share what's left between the heading and the footer; a card
  // with few of them draws them larger (up to MAX_SCALE) rather than leave
  // it bare.
  const top = frame.top + 306;
  const rowHeight = Math.min((frame.bottom - 84 - top) / card.rows.length, ROW_HEIGHT * MAX_SCALE);
  card.rows.forEach((row, i) => {
    const y = top + i * rowHeight;
    if (i > 0) {
      ctx.fillStyle = LINE;
      ctx.fillRect(PAD, y, inner, 2);
    }
    drawRow(ctx, frame, row, y, rowHeight / ROW_HEIGHT, flyers.get(row.flyerUrl ?? '') ?? null);
  });
}

/** Flyer on the left (3:4, as on the site's cards), then time and place,
 * the title, and the styles with the price at the end of their line. */
function drawRow(ctx: Ctx, frame: Frame, row: NightRow, y: number, scale: number, flyer: CanvasImageSource | null): void {
  const thumbWidth = 96 * scale;
  const thumbHeight = 128 * scale;
  const thumbY = y + (ROW_HEIGHT * scale - thumbHeight) / 2;
  drawThumb(ctx, PAD, thumbY, thumbWidth, thumbHeight, flyer, row.title);

  const x = PAD + thumbWidth + 30 * scale;
  const right = frame.width - PAD;
  const width = right - x;

  // The place in mint, the site's "where" colour (--ev-place), so it stands
  // apart from the title under it; the time stays plain.
  ctx.font = `600 ${30 * scale}px ${BODY}`;
  ctx.fillStyle = BONE;
  ctx.fillText(row.time, x, thumbY + 30 * scale);
  if (row.place) {
    const timeWidth = ctx.measureText(`${row.time}  `).width;
    const dotWidth = ctx.measureText('· ').width;
    ctx.fillStyle = MUTED;
    ctx.fillText('·', x + timeWidth, thumbY + 30 * scale);
    ctx.fillStyle = MINT;
    ctx.fillText(clipped(ctx, row.place, width - timeWidth - dotWidth), x + timeWidth + dotWidth, thumbY + 30 * scale);
  }

  ctx.font = `800 ${44 * scale}px ${DISPLAY}`;
  ctx.fillStyle = BONE;
  ctx.fillText(clipped(ctx, row.title, width), x, thumbY + 82 * scale);

  ctx.font = `600 ${28 * scale}px ${BODY}`;
  ctx.fillStyle = PRICE;
  ctx.textAlign = 'right';
  ctx.fillText(row.price, right, thumbY + 124 * scale);
  const priceWidth = ctx.measureText(`${row.price}   `).width;
  ctx.textAlign = 'left';
  ctx.font = `400 ${28 * scale}px ${BODY}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(clipped(ctx, row.styles, width - priceWidth), x, thumbY + 124 * scale);
}

function drawThumb(
  ctx: Ctx,
  x: number,
  y: number,
  width: number,
  height: number,
  flyer: CanvasImageSource | null,
  title: string,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, width * 0.16);
  ctx.clip();
  ctx.fillStyle = INK_2;
  ctx.fillRect(x, y, width, height);
  const size = flyer ? sourceSize(flyer) : null;
  if (flyer && size) {
    // object-cover: fill the tile, crop what spills, centred.
    const zoom = Math.max(width / size.width, height / size.height);
    const drawn = { width: size.width * zoom, height: size.height * zoom };
    ctx.drawImage(flyer, x + (width - drawn.width) / 2, y + (height - drawn.height) / 2, drawn.width, drawn.height);
  } else {
    ctx.fillStyle = ROSE;
    ctx.font = `800 ${width * 0.56}px ${DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title.trim().charAt(0).toUpperCase(), x + width / 2, y + height / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, width * 0.16);
  ctx.stroke();
}

function sourceSize(source: CanvasImageSource): { width: number; height: number } | null {
  const { width, height } = source as { width?: unknown; height?: unknown };
  return typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0 ? { width, height } : null;
}

/** The font at `size`, or as much smaller as it takes for `text` to fit. */
function fitted(ctx: Ctx, text: string, weight: number, size: number, maxWidth: number, family: string): string {
  ctx.font = `${weight} ${size}px ${family}`;
  const width = ctx.measureText(text).width;
  return width <= maxWidth ? ctx.font : `${weight} ${Math.floor((size * maxWidth) / width)}px ${family}`;
}

/** `text` cut short with an ellipsis where it's wider than `maxWidth`, in
 * the context's current font. */
function clipped(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && ctx.measureText(`${text.slice(0, end).trimEnd()}…`).width > maxWidth) end--;
  return `${text.slice(0, end).trimEnd()}…`;
}
