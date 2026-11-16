import { Component, computed, input } from '@angular/core';

/** A run of an owner's text: plain, or a link to open. */
type Part = { text: string; href?: string };

/** Web addresses (with their scheme, or starting at "www."), emails and
 * Instagram handles ("📍 @club_name"). Addresses and emails come first, so the
 * "@" inside one of them is never taken for a handle; a handle's "@" also
 * can't follow a letter, a dot or another "@". Handles are Instagram's:
 * letters, digits, "_" and ".", up to 30, never ending on a dot — a longer
 * one isn't a handle, so it isn't cut down to a link to someone else. */
const LINK =
  /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|(?<![\w.@])@[a-z0-9_](?:[a-z0-9._]{0,28}[a-z0-9_])?(?!\w))/gi;

/** What closes the sentence the address sits in, not the address itself:
 * "iscriviti qui: https://… ." or "(www.club.it)". */
const TRAILING = /[.,;:!?)\]}'"»]+$/;

/** Where a link takes you: a handle to its Instagram profile, an email to a
 * new message, and a bare "www." gets its https://. */
function hrefOf(link: string): string {
  if (link.startsWith('@')) return `https://www.instagram.com/${link.slice(1)}/`;
  if (/^https?:/i.test(link)) return link;
  if (/^www\./i.test(link)) return `https://${link}`;
  return `mailto:${link}`;
}

/** Splits text into plain runs and links. */
export function linkParts(text: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const link = match[0].replace(TRAILING, '');
    const start = match.index;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: link, href: hrefOf(link) });
    last = start + link.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** Text written by a club, a venue or an organizer, with the addresses in it
 * made tappable (a sign-up form, their site, an email, the DJ's or the club's
 * @instagram). Inline, so it goes inside the <p> that sets the text's look —
 * line breaks and clamping stay that paragraph's. Their links, not ours:
 * nofollow and ugc. */
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
