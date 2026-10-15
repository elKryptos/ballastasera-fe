import { Component, computed, input } from '@angular/core';

/** A run of an owner's text: plain, or a link to open. */
type Part = { text: string; href?: string };

/** Web addresses (with their scheme, or starting at "www.") and emails. */
const LINK = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/gi;

/** What closes the sentence the address sits in, not the address itself:
 * "iscriviti qui: https://… ." or "(www.club.it)". */
const TRAILING = /[.,;:!?)\]}'"»]+$/;

/** Splits text into plain runs and links. Emails become mailto: links, and a
 * bare "www." gets its https://. */
export function linkParts(text: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const link = match[0].replace(TRAILING, '');
    const start = match.index;
    if (start > last) parts.push({ text: text.slice(last, start) });
    const href = link.includes('@') && !/^https?:|^www\./i.test(link)
      ? `mailto:${link}`
      : /^https?:/i.test(link) ? link : `https://${link}`;
    parts.push({ text: link, href });
    last = start + link.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** Text written by a club, a venue or an organizer, with the addresses in it
 * made tappable (a sign-up form, their site, an email). Inline, so it goes
 * inside the <p> that sets the text's look — line breaks and clamping stay
 * that paragraph's. Their links, not ours: nofollow and ugc. */
@Component({
  selector: 'app-linked-text',
  // Every text sits tight inside its element: the whitespace-only lines
  // between them are dropped, but a space next to a text would show.
  template: `
    @for (part of parts(); track $index) {
      @if (part.href) {
        <a [href]="part.href" target="_blank" rel="noopener noreferrer nofollow ugc"
          class="font-semibold text-(--ev-link) underline underline-offset-2">{{ part.text }}</a>
      } @else {
        <ng-container>{{ part.text }}</ng-container>
      }
    }
  `,
  // A long address has nowhere to break: without this it runs off a phone's
  // screen and the browser zooms the whole page out to fit it.
  host: { class: 'wrap-anywhere' },
})
export class LinkedText {
  readonly text = input.required<string>();
  protected readonly parts = computed(() => linkParts(this.text()));
}
