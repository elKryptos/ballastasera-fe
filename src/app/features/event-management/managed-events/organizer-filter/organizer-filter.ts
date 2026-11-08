import { Component, inject, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { OrganizerAdminDto } from '../../../../core/models/organizer.model';
import { AdminService } from '../../../../core/services/admin.service';

/** "Organizzatore: tutti" (AdminSerate.dc.html): the dashed button is a select over the verified
 * organizers (the first 100, like the admin forms' picker). */
@Component({
  selector: 'app-organizer-filter',
  host: { class: 'relative inline-flex' },
  template: `
    <svg viewBox="0 0 24 24" class="pointer-events-none absolute top-1/2 left-3 size-3.75 -translate-y-1/2 text-lead"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
    <label for="managed-events-organizer" class="sr-only">Organizzatore</label>
    <select id="managed-events-organizer"
      class="h-9 max-w-full cursor-pointer appearance-none truncate rounded-xl border border-dashed border-bone/24 bg-transparent pr-3 pl-8 text-[0.8125rem] font-semibold text-lead"
      (change)="pick($any($event.target).value)">
      <option value="">Organizzatore: tutti</option>
      @for (organizer of organizers(); track organizer.id) {
      <option [value]="organizer.id" [selected]="organizer.id === selectedId()">Organizzatore: {{ organizer.name }}</option>
      }
    </select>
  `,
})
export class OrganizerFilter {
  protected readonly organizers = toSignal(
    inject(AdminService)
      .getVerifiedOrganizers(0, 100)
      .pipe(
        map((page) => page.content),
        catchError(() => of<OrganizerAdminDto[]>([])),
      ),
    { initialValue: [] as OrganizerAdminDto[] },
  );
  protected readonly selectedId = signal('');
  /** The picked organizer, null for all of them. */
  readonly organizerChange = output<OrganizerAdminDto | null>();

  protected pick(id: string): void {
    this.selectedId.set(id);
    this.organizerChange.emit(this.organizers().find((organizer) => organizer.id === id) ?? null);
  }
}
