import { Signal, WritableSignal, computed, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';

/** How long to wait after the last keystroke before asking. */
export const SEARCH_DEBOUNCE_MS = 300;

export interface RemoteSearch<T> {
  /** What's typed: an autocomplete's (searchChange) writes it. */
  search: WritableSignal<string>;
  /** A question on its way: "Ricerca in corso…". */
  searching: Signal<boolean>;
  /** The last answer; empty below minLength or when the search failed. */
  results: Signal<T[]>;
  /** The answer on screen is for what's typed now, and nothing is on its way: only then can "nothing
   * found" be said (before the debounce, results are still the previous term's, or none yet). */
  settled: Signal<boolean>;
}

/**
 * The signals an hlm-autocomplete binds to for a search done by a server (Photon's addresses and
 * cities, the schools): what's typed, debounced, asked for once it's at least `minLength` long, the
 * older answer dropped when a newer question goes out. A failed search reads as no results. Call
 * from an injection context (a field initializer).
 */
export function injectRemoteSearch<T>(
  fetch: (term: string) => Observable<T[]>,
  minLength: number,
  debounceMs = SEARCH_DEBOUNCE_MS,
): RemoteSearch<T> {
  const search = signal('');
  const searching = signal(false);
  /** The term the results belong to. */
  const answered = signal<string | null>(null);
  const results = toSignal(
    toObservable(search).pipe(
      map((term) => term.trim()),
      debounceTime(debounceMs),
      distinctUntilChanged(),
      switchMap((term) => {
        if (term.length < minLength) {
          searching.set(false);
          answered.set(term);
          return of<T[]>([]);
        }
        searching.set(true);
        return fetch(term).pipe(
          catchError(() => of<T[]>([])),
          tap(() => {
            searching.set(false);
            answered.set(term);
          }),
        );
      }),
    ),
    { initialValue: [] as T[] },
  );
  const settled = computed(() => !searching() && answered() === search().trim());
  return { search, searching: searching.asReadonly(), results, settled };
}
