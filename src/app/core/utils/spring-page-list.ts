import { DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, of, switchMap } from 'rxjs';
import { SpringPage } from '../models/page.model';

/**
 * One list paged by number (SpringPage, the admin's lists), as signals: the page shown, how many
 * pages and items, loading/failed. Only the latest page asked for shows, however fast the pages or
 * the tabs change; when the last item of the last page goes (a report reviewed, someone unbanned),
 * it steps back a page. Create it in an injection context, like CursorList.
 */
export class SpringPageList<T> {
  private readonly itemsSignal = signal<readonly T[]>([]);
  private readonly pageSignal = signal(0);
  private readonly totalPagesSignal = signal(0);
  private readonly totalSignal = signal<number | null>(null);
  private readonly loadingSignal = signal(true);
  private readonly failedSignal = signal(false);
  private readonly ask$ = new Subject<number>();

  readonly items = this.itemsSignal.asReadonly();
  readonly page = this.pageSignal.asReadonly();
  readonly totalPages = this.totalPagesSignal.asReadonly();
  /** Every item, all pages together; null until the first answer. */
  readonly total = this.totalSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly failed = this.failedSignal.asReadonly();
  readonly isEmpty = computed(() => !this.loadingSignal() && !this.failedSignal() && this.itemsSignal().length === 0);

  constructor(fetch: (page: number) => Observable<SpringPage<T>>) {
    this.ask$
      .pipe(
        switchMap((page) => fetch(page).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((result) => {
        if (result && result.content.length === 0 && this.pageSignal() > 0) {
          this.goTo(this.pageSignal() - 1);
          return;
        }
        this.loadingSignal.set(false);
        this.failedSignal.set(result === null);
        this.itemsSignal.set(result?.content ?? []);
        this.totalPagesSignal.set(result?.page.totalPages ?? 0);
        if (result) this.totalSignal.set(result.page.totalElements);
      });
  }

  /** From the first page: a new tab, or the first load. */
  reset(): void {
    this.itemsSignal.set([]);
    this.totalSignal.set(null);
    this.goTo(0);
  }

  /** The page shown, asked again: after something in it changed. */
  reload(): void {
    this.goTo(this.pageSignal());
  }

  goTo(page: number): void {
    this.pageSignal.set(page);
    this.loadingSignal.set(true);
    this.ask$.next(page);
  }
}
