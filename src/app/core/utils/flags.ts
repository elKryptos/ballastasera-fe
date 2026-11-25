import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

/** A country's flag as an emoji: its two ISO letters as regional indicators ("IT" → 🇮🇹). '' for
 * anything that isn't two letters. */
export function flagEmoji(code: string | null | undefined): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return '';
  const base = 0x1f1e6 - 'A'.charCodeAt(0);
  return String.fromCodePoint(...[...code.toUpperCase()].map((letter) => base + letter.charCodeAt(0)));
}

/**
 * Whether this device draws flag emojis. Windows doesn't: Chrome there shows the two letters, which
 * next to the country's name read as a typo, so where flags aren't drawn they're left out. Asked once,
 * by drawing 🇮🇹 on a canvas: a real flag has colour, the letters fallback is plain text. False on the
 * server and wherever the canvas can't be read.
 */
@Injectable({ providedIn: 'root' })
export class FlagEmoji {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private answer: boolean | null = null;

  get supported(): boolean {
    this.answer ??= this.isBrowser && this.test();
    return this.answer;
  }

  /** The country's flag where the device draws it, '' elsewhere. */
  of(code: string | null | undefined): string {
    return this.supported ? flagEmoji(code) : '';
  }

  private test(): boolean {
    try {
      const canvas = this.document.createElement('canvas');
      canvas.width = canvas.height = 24;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return false;
      context.fillStyle = '#000';
      context.textBaseline = 'top';
      context.font = '20px sans-serif';
      context.fillText(flagEmoji('IT'), 0, 0);
      const pixels = context.getImageData(0, 0, 24, 24).data;
      // Black letters stay grey; Italy's green and red don't.
      for (let i = 0; i < pixels.length; i += 4) {
        const [r, g, b, a] = [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
        if (a > 0 && Math.max(r, g, b) - Math.min(r, g, b) > 40) return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
