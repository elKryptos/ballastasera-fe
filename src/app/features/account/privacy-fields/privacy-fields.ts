import { Component, computed, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
  ATTENDANCE_VISIBILITY_LABELS,
  ATTENDANCE_VISIBILITY_TEXTS,
  PRIVATE_PROFILE_TEXT,
  PUBLIC_PROFILE_TEXT,
  VISIBILITY_ORDER,
} from '../../../core/config/social';
import { ContactVisibility } from '../../../core/models/user.model';
import { controlValue, toggleControl } from '../../../core/utils/form-controls';
import { Choice, ChoiceGroup } from '../../../shared/choice-group/choice-group';
import { ToggleSwitch } from '../../../shared/toggle-switch/toggle-switch';
import { PROFILE_FORM } from '../profile-form';

/**
 * Who sees what, with the social features (canvas 4b, "Contatti e privacy"): "Chi vede le serate a
 * cui vai" (everyone, friends, only you) and "Profilo pubblico", whose off is said in full as the plan
 * wants it: private shuts the profile off from everyone, friends too, and from invites. Part of the
 * account's one form. Without the social features the account keeps its own "Profilo visibile".
 */
@Component({
  selector: 'app-privacy-fields',
  imports: [ReactiveFormsModule, ChoiceGroup, ToggleSwitch],
  templateUrl: './privacy-fields.html',
  // Its two settings are items of the section's grid ("Chi ti vede"): side by side where there's room.
  host: { class: 'contents' },
})
export class PrivacyFields {
  protected readonly form = inject(PROFILE_FORM);

  protected readonly isPublic = controlValue(this.form.controls.showProfilePublic);
  private readonly attendance = controlValue(this.form.controls.attendanceVisibility);
  protected readonly attendanceText = computed(() => ATTENDANCE_VISIBILITY_TEXTS[this.attendance()]);
  protected readonly publicText = computed(() => (this.isPublic() ? PUBLIC_PROFILE_TEXT : PRIVATE_PROFILE_TEXT));
  protected readonly attendanceChoices: Choice<ContactVisibility>[] = VISIBILITY_ORDER.map((value) => ({
    value,
    label: ATTENDANCE_VISIBILITY_LABELS[value],
  }));

  protected togglePublic(): void {
    toggleControl(this.form.controls.showProfilePublic);
  }
}
