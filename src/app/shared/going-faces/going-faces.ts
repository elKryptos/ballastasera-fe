import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { GOING_FACES } from '../../core/utils/going-faces';

/** A face's width (size-6), and how much the next one covers of it (-ml-2). */
const FACE_PX = 24;
const OVERLAP_PX = 8;

/** Who's going, on the map's card and the list's: the faces of the first few
 * (goingAvatars) and a "+N" for everyone else, count being the total — no
 * names, the event's page has those. Nobody going shows a face (they keep
 * their profile private, or have no photo), and it's the count in words, as
 * before there were faces. Each face is ringed in the card's colour, ring,
 * so the overlap reads as a stack.
 * It takes the rest of its row and shows as many faces as fit there: beside
 * the flyer a small phone leaves the list's row ~56px, three faces and a
 * "+N" are 72. Those that don't fit go into the "+N"; none fitting, it's the
 * count in words again, which truncates. */
@Component({
  selector: 'app-going-faces',
  template: `
    @if (faces().length) {
    <span class="flex shrink-0 items-center" role="img" [attr.aria-label]="count() + ' ' + words()">
      @for (url of faces(); track $index; let first = $first) {
      <img [src]="url" alt="" referrerpolicy="no-referrer" loading="lazy" decoding="async"
        class="size-6 rounded-full border-2 border-(--faces-ring) bg-(--ev-tag-bg) object-cover"
        [class.-ml-2]="!first" />
      }
      @if (more() > 0) {
      <span
        class="-ml-2 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-(--faces-ring) bg-(--ev-tag-bg) px-1 text-[0.6875rem] font-extrabold text-(--ev-tag-text) tabular-nums">
        +{{ more() }}
      </span>
      }
    </span>
    } @else {
    <span class="min-w-0 truncate"><strong class="font-bold text-(--ev-text)">{{ count() }}</strong> {{ words() }}</span>
    }
  `,
  host: { class: 'flex min-w-0 flex-1', '[style.--faces-ring]': 'ring()' },
})
export class GoingFaces {
  readonly avatars = input<readonly string[] | undefined>([]);
  readonly count = input.required<number>();
  /** The card's background, as a colour. */
  readonly ring = input('var(--ev-surface)');

  /** The room this has, once measured: null server-side and until then,
   * which shows every face. */
  private readonly width = signal<number | null>(null);

  private readonly all = computed(() => (this.avatars() ?? []).slice(0, GOING_FACES));
  /** A number, so a resize that fits as many faces as before changes nothing. */
  private readonly shown = computed(() => {
    const width = this.width();
    let shown = this.all().length;
    if (width === null) return shown;
    while (shown > 0 && stackWidth(shown, this.count() - shown) > width) shown--;
    return shown;
  });
  protected readonly faces = computed(() => this.all().slice(0, this.shown()));
  protected readonly more = computed(() => Math.max(0, this.count() - this.shown()));
  protected readonly words = computed(() => (this.count() === 1 ? 'ci va' : 'ci vanno'));

  constructor() {
    const host: HTMLElement = inject(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => destroyRef.onDestroy(observeWidth(host, (width) => this.width.set(width))));
  }
}

/** How wide `faces` faces and, for `more` left out, their "+N" come out.
 * The chip is its border and padding (12px) plus ~7px a character. */
function stackWidth(faces: number, more: number): number {
  const chip = more > 0 ? Math.max(FACE_PX, 12 + 7 * `+${more}`.length) - OVERLAP_PX : 0;
  return FACE_PX + (FACE_PX - OVERLAP_PX) * (faces - 1) + chip;
}

/** One ResizeObserver for every GoingFaces — the list has one per card. */
let observer: ResizeObserver | undefined;
const listeners = new WeakMap<Element, (width: number) => void>();

/** Calls listener with element's width as it changes; returns the call
 * that stops it. */
function observeWidth(element: Element, listener: (width: number) => void): () => void {
  observer ??= new ResizeObserver((entries) => {
    for (const entry of entries) listeners.get(entry.target)?.(entry.contentRect.width);
  });
  listeners.set(element, listener);
  observer.observe(element);
  return () => {
    observer?.unobserve(element);
    listeners.delete(element);
  };
}
