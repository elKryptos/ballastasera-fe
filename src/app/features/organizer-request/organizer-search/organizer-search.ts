import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucidePlus, lucideSearch } from '@ng-icons/lucide';
import { Observable, catchError, concat, debounceTime, distinctUntilChanged, map, of, startWith, switchMap, tap } from 'rxjs';
import { ORGANIZER_TYPE_LABELS } from '../../../core/config/organizer-types';
import { OrganizerSummaryDto } from '../../../core/models/organizer.model';
import { OrganizersService } from '../../../core/services/organizers.service';
import { instagramHandle } from '../../../core/utils/event-format';
import { OrganizerAvatar } from '../../../shared/organizer-avatar/organizer-avatar';
import { OrganizerRequestFormStore } from '../organizer-request-form.store';

/** The backend refuses a shorter name. */
const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 300;

interface SearchState {
  status: 'idle' | 'loading' | 'done' | 'error';
  results: OrganizerSummaryDto[];
}

/** Finds an organizer nobody owns yet by name; picking one makes the request
 * a CLAIM, the last row makes it a NEW. */
@Component({
  selector: 'app-organizer-search',
  imports: [ReactiveFormsModule, NgIcon, OrganizerAvatar],
  providers: [provideIcons({ lucideCheck, lucidePlus, lucideSearch })],
  host: { class: 'block' },
  templateUrl: './organizer-search.html',
})
export class OrganizerSearch {
  protected readonly store = inject(OrganizerRequestFormStore);
  private readonly organizers = inject(OrganizersService);

  protected readonly typeLabels = ORGANIZER_TYPE_LABELS;
  protected readonly instagramHandle = instagramHandle;
  protected readonly minQueryLength = MIN_QUERY_LENGTH;
  protected readonly query = new FormControl(this.store.searchQuery(), { nonNullable: true });

  protected readonly search = toSignal(
    this.query.valueChanges.pipe(
      map((value) => value.trim()),
      tap((name) => this.store.searchQuery.set(name)),
      debounceTime(DEBOUNCE_MS),
      // Coming back to a search shows it at once: only typing waits.
      startWith(this.query.value.trim()),
      distinctUntilChanged(),
      switchMap((name) => this.searchFor(name)),
    ),
    { initialValue: { status: 'idle', results: [] } as SearchState },
  );

  private searchFor(name: string): Observable<SearchState> {
    if (name.length < MIN_QUERY_LENGTH) return of({ status: 'idle', results: [] });
    return concat(
      of<SearchState>({ status: 'loading', results: [] }),
      this.organizers.getClaimable(name).pipe(
        map((results): SearchState => ({ status: 'done', results })),
        catchError(() => of<SearchState>({ status: 'error', results: [] })),
      ),
    );
  }
}
