import { Component, computed, inject } from '@angular/core';
import { SCHOOL_NAME_MAX } from '../../../core/config/social';
import { OrganizerSummaryDto } from '../../../core/models/organizer.model';
import { OrganizersService } from '../../../core/services/organizers.service';
import { controlValue } from '../../../core/utils/form-controls';
import { injectRemoteSearch } from '../../../core/utils/remote-search';
import { OrganizerAvatar } from '../../../shared/organizer-avatar/organizer-avatar';
import { PROFILE_FORM } from '../profile-form';

/** The schools' search wants at least this many letters. */
const MIN_LENGTH = 2;

/**
 * "Scuola o crew" (canvas 4b, social phase 2): typing looks among the app's schools (verified SCHOOL
 * organizers) and picking one links it, a chip with ✕; a school that isn't in the app is just its
 * name, typed. Either way it's the form's `school` (SchoolPick).
 */
@Component({
  selector: 'app-school-field',
  imports: [OrganizerAvatar],
  templateUrl: './school-field.html',
  styleUrls: ['../search-field.css', './school-field.css'],
})
export class SchoolField {
  private readonly form = inject(PROFILE_FORM);
  private readonly organizers = inject(OrganizersService);

  protected readonly school = controlValue(this.form.controls.school);
  protected readonly linked = computed(() => (this.school()?.organizerId ? this.school() : null));
  protected readonly typed = computed(() => (this.linked() ? '' : (this.school()?.name ?? '')));
  protected readonly search = injectRemoteSearch((term) => this.organizers.searchSchools(term), MIN_LENGTH);
  protected readonly minLength = MIN_LENGTH;
  protected readonly maxLength = SCHOOL_NAME_MAX;

  /** Typed by hand: a school by its name only, until one of the app's is picked. */
  protected type(name: string): void {
    this.set(name.trim() ? { organizerId: null, name } : null);
    this.search.search.set(name);
  }

  protected pick(school: OrganizerSummaryDto): void {
    this.set({ organizerId: school.id, name: school.name });
    this.search.search.set('');
  }

  protected clear(): void {
    this.set(null);
  }

  private set(value: { organizerId: string | null; name: string } | null): void {
    const control = this.form.controls.school;
    control.setValue(value);
    control.markAsDirty();
  }
}
