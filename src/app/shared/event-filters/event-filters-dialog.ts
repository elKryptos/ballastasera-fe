import {
  Component,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DanceStyleDto } from '../../core/models/dance-style.model';
import { EVENT_TYPE_LABELS, PIN_TYPES } from '../../core/config/map-pins';
import { EventFiltersService } from '../../core/services/event-filters.service';
import { EventPinIcon } from './pin-icons';

/**
 * Everything beyond the day — styles, kind of night, price — for /mappa and
 * /lista. Changes apply as they're tapped (it's all client-side, see
 * EventFiltersService), the footer only shows how many nights are left and
 * closes. Page-specific sections are projected in: the ones marked
 * `filtersLead` (the map's layers) before the shared ones, the rest (the
 * map's cities) after. Styles live in styles.css (.ev-dialog).
 */
@Component({
  selector: 'app-event-filters-dialog',
  imports: [EventPinIcon],
  templateUrl: './event-filters-dialog.html',
})
export class EventFiltersDialog {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly filters = inject(EventFiltersService);

  readonly open = model(false);
  readonly danceStyles = input.required<DanceStyleDto[]>();
  /** Nights left with the current filters, for the footer button; null
   * while not known yet (still loading). */
  readonly resultCount = input<number | null>(null);
  /** Footer button text instead of the count — the map with places only. */
  readonly doneLabel = input<string | null>(null);
  /** /lista has its own row of style chips, so it leaves them out here. */
  readonly showStyles = input(true);
  /** The page has filters of its own that are on (the map's layer) — counts
   * for enabling "Azzera", which also emits `cleared` for the page to reset them. */
  readonly extraActive = input(false);
  readonly cleared = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly typeOptions = PIN_TYPES.map((type) => ({ type, label: EVENT_TYPE_LABELS[type] }));

  protected readonly canClear = computed(() => this.filters.activeCount() > 0 || this.extraActive());

  protected readonly resultLabel = computed(() => {
    const done = this.doneLabel();
    if (done) return done;
    const count = this.resultCount();
    if (count === null) return 'Mostra le serate';
    if (count === 0) return 'Nessuna serata, per ora';
    return count === 1 ? 'Mostra 1 serata' : `Mostra ${count} serate`;
  });

  constructor() {
    // showModal() rather than the open attribute: that's what puts it in the
    // top layer, makes the page behind inert and lets Esc close it.
    effect(() => {
      const open = this.open();
      if (!this.isBrowser) return;
      const dialog = this.dialog().nativeElement;
      if (open && !dialog.open) dialog.showModal();
      else if (!open && dialog.open) dialog.close();
    });
  }

  /** The dialog's own sections fill it edge to edge, so a click whose target
   * is the <dialog> itself landed on the backdrop around it. */
  protected closeOnBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.open.set(false);
  }

  protected clearAll(): void {
    this.filters.clear();
    this.cleared.emit();
  }
}
