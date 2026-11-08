import { Component, signal } from '@angular/core';
import { outputFromObservable, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map, skip } from 'rxjs';

/** How long to wait after the last keystroke before searching again. */
const SEARCH_DEBOUNCE_MS = 300;

/** The admin's search box (AdminSerate.dc.html). The backend searches the title. Emits once the
 * typing stops. */
@Component({
  selector: 'app-event-search',
  host: { class: 'block' },
  template: `
    <div class="flex h-12 items-center gap-2 rounded-[0.875rem] border border-line bg-(--ev-raised) px-3.5">
      <svg viewBox="0 0 24 24" class="size-4.5 shrink-0 text-muted" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <label for="managed-events-search" class="sr-only">Cerca una serata</label>
      <input id="managed-events-search" type="search" placeholder="Cerca per titolo" autocomplete="off"
        class="h-11 min-w-0 grow bg-transparent text-base text-(--ev-text) outline-none placeholder:text-muted"
        [value]="term()" (input)="term.set($any($event.target).value)" />
    </div>
  `,
})
export class EventSearch {
  protected readonly term = signal('');

  /** skip(1): the empty search it starts with is the list's own. */
  readonly searchChange = outputFromObservable(
    toObservable(this.term).pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      map((term) => term.trim()),
      distinctUntilChanged(),
      skip(1),
    ),
  );
}
