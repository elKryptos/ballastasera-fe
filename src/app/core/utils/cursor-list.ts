import { DestroyRef, computed, inject, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { CursorPage, PageCursor } from '../models/page.model';

/** Asks for one page: null for the first, else where the previous one left off. */
export type PageFetcher<T> = (cursor: PageCursor | null) => Observable<CursorPage<T>>;

/**
 * One list paged by cursor (CursorPage), as signals: the items loaded so far,
 * the total, whether there's a next page, loading/error. Per list, not a
 * singleton: "Le tue serate" keeps four (Parteciperò and Mi piace, upcoming
 * and past). Create it in a field initializer or a constructor — it injects
 * DestroyRef to cancel its request with the component.
 *
 * The total comes from the first page only; after that the list adjusts it
 * itself on remove/restore. A later page's total would count an item removed
 * here whose DELETE is still waiting out its Annulla.
 */
export class CursorList<T extends { id: string }> {
  private readonly itemsSignal = signal<readonly T[]>([]);
  private readonly totalSignal = signal(0);
  private readonly cursor = signal<PageCursor | null>(null);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal(false);
  private readonly loadedSignal = signal(false);
  private request: Subscription | null = null;

  readonly items = this.itemsSignal.asReadonly();
  readonly total = this.totalSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  /** The first page arrived: before that it's placeholders, not "empty". */
  readonly loaded = this.loadedSignal.asReadonly();
  readonly hasMore = computed(() => this.cursor() !== null);
  readonly isEmpty = computed(() => this.loadedSignal() && this.itemsSignal().length === 0);

  constructor(
    private readonly fetch: PageFetcher<T>,
    /** Each page's items as they arrive, e.g. to mark them as going/liked. */
    private readonly onPage?: (items: T[]) => void,
  ) {
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  /** The first page, replacing whatever was there. Also the retry after an error. */
  reload(): void {
    this.request?.unsubscribe();
    this.itemsSignal.set([]);
    this.cursor.set(null);
    this.loadedSignal.set(false);
    this.fetchPage(null);
  }

  /** The next page, appended. Does nothing while one is loading or after the last. */
  loadMore(): void {
    const cursor = this.cursor();
    if (!cursor || this.loadingSignal()) return;
    this.fetchPage(cursor);
  }

  /** Takes an item out on the spot (optimistic remove) and returns where it
   * was, for restore(). null: it wasn't in the list. */
  removeLocal(id: string): number | null {
    const index = this.itemsSignal().findIndex((item) => item.id === id);
    if (index === -1) return null;
    this.itemsSignal.update((items) => items.filter((item) => item.id !== id));
    this.totalSignal.update((total) => Math.max(0, total - 1));
    return index;
  }

  /** Puts back what removeLocal took out — Annulla, or the DELETE failed. */
  restore(item: T, index: number): void {
    this.itemsSignal.update((items) => {
      if (items.some((existing) => existing.id === item.id)) return items;
      const next = [...items];
      next.splice(Math.min(index, next.length), 0, item);
      return next;
    });
    this.totalSignal.update((total) => total + 1);
  }

  private fetchPage(cursor: PageCursor | null): void {
    const first = cursor === null;
    this.loadingSignal.set(true);
    this.errorSignal.set(false);

    this.request = this.fetch(cursor).subscribe({
      next: (page) => {
        this.itemsSignal.update((items) => (first ? page.items : [...items, ...page.items]));
        if (first) this.totalSignal.set(page.total);
        this.cursor.set(nextCursor(page));
        this.loadingSignal.set(false);
        this.loadedSignal.set(true);
        this.onPage?.(page.items);
      },
      error: () => {
        this.loadingSignal.set(false);
        this.errorSignal.set(true);
      },
    });
  }
}

/** Where the next page starts, or null when this was the last. */
function nextCursor(page: CursorPage<unknown>): PageCursor | null {
  return page.nextCursorStartAt && page.nextCursorId
    ? { startAt: page.nextCursorStartAt, id: page.nextCursorId }
    : null;
}
