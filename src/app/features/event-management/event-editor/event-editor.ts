import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { CityDto } from '../../../core/models/city.model';
import { DanceStyleDto } from '../../../core/models/dance-style.model';
import { EventDetailDto } from '../../../core/models/event.model';
import { OrganizerDetailDto } from '../../../core/models/organizer.model';
import { CitiesService } from '../../../core/services/cities.service';
import { DanceStylesService } from '../../../core/services/dance-styles.service';
import { EventManagementService } from '../../../core/services/event-management.service';
import { OrganizersService } from '../../../core/services/organizers.service';
import { FilePreview } from '../../../core/utils/file-preview';
import { PendingAction } from '../../../core/utils/pending-action';
import { SidebarPushDirective } from '../../../shared/directives/sidebar-push.directive';
import { EVENT_MANAGEMENT_CONTEXT } from '../event-management.context';
import { eventErrorMessage } from '../event-management-errors';
import { FlyerPicker } from './flyer-picker/flyer-picker';
import { BasicsSection } from './basics-section/basics-section';
import { ContactsSection } from './contacts-section/contacts-section';
import { EntrySection } from './entry-section/entry-section';
import { EventEditorFormStore } from './event-editor-form.store';
import { OrganizerSection } from './organizer-section/organizer-section';
import { PlaceSection } from './place-section/place-section';
import { ScheduleSection } from './schedule-section/schedule-section';

/** What the form starts from: the lists it looks names up in, and the night or the organizer. */
interface EditorStart {
  cities: CityDto[];
  styles: DanceStyleDto[];
  event: EventDetailDto | null;
  organizer: OrganizerDetailDto | null;
}

/** How the flyer went after saving, told to the night's page through the navigation state. */
type FlyerOutcome = 'ok' | 'uploadFailed' | 'removeFailed';

interface SavedNight {
  event: EventDetailDto;
  flyer: FlyerOutcome;
}

/**
 * "Nuova serata" (nuova) and editing a night (:id/modifica): one form for the admin and the
 * organizer, in five blocks plus the flyer, as on the canvas (SerataNuova). The flyer goes up after
 * the night is saved, so it's picked without saving first. Saving leads to the night's page.
 */
@Component({
  selector: 'app-event-editor',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    SidebarPushDirective,
    FlyerPicker,
    OrganizerSection,
    BasicsSection,
    ScheduleSection,
    PlaceSection,
    EntrySection,
    ContactsSection,
  ],
  providers: [EventEditorFormStore],
  host: { class: 'block min-h-dvh bg-ground text-(--ev-text)' },
  templateUrl: './event-editor.html',
})
export class EventEditor {
  protected readonly context = inject(EVENT_MANAGEMENT_CONTEXT);
  protected readonly store = inject(EventEditorFormStore);
  private readonly service = inject(EventManagementService);
  private readonly cities = inject(CitiesService);
  private readonly styles = inject(DanceStylesService);
  private readonly organizers = inject(OrganizersService);
  private readonly router = inject(Router);

  /** The night being edited; null for a new one. */
  protected readonly eventId = inject(ActivatedRoute).snapshot.paramMap.get('id');
  protected readonly isAdmin = this.context.scope === 'admin';
  protected readonly loaded = signal(false);
  protected readonly loadFailed = signal(false);
  /** The night to edit doesn't exist, or isn't of the organizer's page: no form. */
  protected readonly missing = signal(false);
  /** An organizer without a page has nobody to publish as. */
  protected readonly noOrganizer = computed(() => !this.isAdmin && !this.eventId && this.store.organizer() === null);
  /** The back link goes to the night's page when editing one that opened, else to the list. */
  protected readonly backToNight = computed(() => this.eventId !== null && !this.missing());

  private readonly flyerFile = signal<File | null>(null);
  private readonly flyerPreview = new FilePreview();
  /** Editing a night with a flyer and «Rimuovi» tapped: it comes off once the night is saved. */
  protected readonly flyerRemoval = signal(false);
  protected readonly flyerShown = computed(
    () => this.flyerPreview.url() ?? (this.flyerRemoval() ? null : (this.store.event()?.flyerUrl ?? null)),
  );
  /** The saved flyer is still being converted: it can't be changed or removed until it's done, or a
   * second conversion would race the first for the same file. */
  protected readonly flyerProcessing = computed(() => this.store.event()?.flyerStatus === 'PROCESSING');
  /** «Rimuovi» for a picked file, or for the saved flyer once it's done converting. While a removal
   * is pending the picker shows «Ripristina» instead, whatever this says. */
  protected readonly flyerRemovable = computed(() => {
    if (this.flyerFile()) return true;
    return !!this.store.event()?.flyerUrl && !this.flyerProcessing();
  });
  protected readonly saving = new PendingAction();
  /** The form has something to fix: said by the button, the fields say what. */
  protected readonly invalidOnSave = signal(false);

  constructor() {
    this.load();
  }

  protected pickFlyer(file: File): void {
    this.flyerFile.set(file);
    this.flyerPreview.show(file);
    // A new flyer replaces the saved one anyway: nothing left to take off.
    this.flyerRemoval.set(false);
  }

  /** A picked file is just dropped (the saved flyer, if any, shows again). The saved flyer is
   * marked to come off on save, so «Salva» stays the only thing that changes the night. */
  protected removeFlyer(): void {
    const hadPick = this.flyerFile() !== null;
    this.flyerFile.set(null);
    this.flyerPreview.clear();
    if (!hadPick && this.store.event()?.flyerUrl) this.flyerRemoval.set(true);
  }

  protected restoreFlyer(): void {
    this.flyerRemoval.set(false);
  }

  protected save(): void {
    const form = this.store.form;
    if (form.invalid) {
      form.markAllAsTouched();
      this.invalidOnSave.set(true);
      return;
    }
    this.invalidOnSave.set(false);
    const saved = this.eventId ? this.saveChanges(this.eventId) : this.service.create(this.context.scope, this.store.createBody());
    this.saving.run(saved.pipe(switchMap((event) => this.applyFlyer(event))), {
      // The night's page says so when the flyer didn't go up or didn't come off
      // (managed-event reads flyerFailed and flyerRemoveFailed).
      next: ({ event, flyer }) =>
        this.router.navigate([this.context.basePath, event.id], {
          state: { flyerFailed: flyer === 'uploadFailed', flyerRemoveFailed: flyer === 'removeFailed' },
        }),
      errorMessage: eventErrorMessage,
    });
  }

  /** Only what changed. A night leaving its venue for an address has the venue taken off last: the
   * PATCH is what the backend may refuse (an address it can't place, a start already gone), and a
   * refused PATCH leaves the night as it was, venue included. */
  private saveChanges(id: string): Observable<EventDetailDto> {
    const body = this.store.updateBody();
    const updated =
      Object.keys(body).length > 0 ? this.service.update(this.context.scope, id, body) : of(this.store.event()!);
    return this.store.removesVenue() ? updated.pipe(switchMap(() => this.service.removeVenue(id))) : updated;
  }

  /** The flyer, once the night exists: the picked file goes up, or the saved one comes off. Either
   * failing doesn't lose the night: its page says so, and it can be done again there. */
  private applyFlyer(event: EventDetailDto): Observable<SavedNight> {
    const file = this.flyerFile();
    if (file) {
      return this.service.uploadFlyer(this.context.scope, event.id, file).pipe(
        map((uploaded): SavedNight => ({ event: uploaded, flyer: 'ok' })),
        catchError(() => of<SavedNight>({ event, flyer: 'uploadFailed' })),
      );
    }
    if (this.flyerRemoval() && event.flyerUrl) {
      return this.service.deleteFlyer(this.context.scope, event.id).pipe(
        map((updated): SavedNight => ({ event: updated, flyer: 'ok' })),
        catchError(() => of<SavedNight>({ event, flyer: 'removeFailed' })),
      );
    }
    return of<SavedNight>({ event, flyer: 'ok' });
  }

  private load(): void {
    const start: Observable<EditorStart> = forkJoin({
      cities: this.cities.getCities(),
      styles: this.styles.getDanceStyles(),
      // For the organizer, another page's night comes back null, like a missing one.
      event: this.eventId ? this.service.getManaged(this.context.scope, this.eventId) : of(null),
      // Only a new night needs it: an edited one comes with its organizer.
      organizer: this.isAdmin || this.eventId ? of(null) : this.organizers.ensureMine(),
    });
    start.pipe(finalize(() => this.loaded.set(true))).subscribe({
      next: ({ cities, styles, event, organizer }) => {
        if (event) this.store.startEdit(this.context.scope, event, cities, styles);
        else if (this.eventId) this.missing.set(true);
        else this.store.startCreate(this.context.scope, organizer, cities);
      },
      error: () => this.loadFailed.set(true),
    });
  }
}
