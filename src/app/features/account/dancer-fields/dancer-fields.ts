import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { DANCE_ROLES, DANCE_ROLE_LABELS, GENDERS, GENDER_LABELS } from '../../../core/config/dance-profile';
import { DanceRole, Gender } from '../../../core/models/user.model';
import { Choice, ChoiceGroup } from '../../../shared/choice-group/choice-group';
import { RequestField } from '../../../shared/request-field/request-field';
import { BirthDatePicker } from '../birth-date-picker/birth-date-picker';
import { PROFILE_FORM } from '../profile-form';

/** Who the user is as a dancer, in "Il tuo account": birth date (others only see the age),
 * gender and role. All three optional: gender and role are ChoiceGroups that can be unpicked
 * by tapping the picked one again (clearable), picked in the inverted colour. */
@Component({
  selector: 'app-dancer-fields',
  imports: [ReactiveFormsModule, RequestField, BirthDatePicker, ChoiceGroup],
  templateUrl: './dancer-fields.html',
  styleUrl: './dancer-fields.css',
})
export class DancerFields {
  protected readonly form = inject(PROFILE_FORM);

  protected readonly genders: Choice<Gender>[] = GENDERS.map((value) => ({ value, label: GENDER_LABELS[value] }));
  protected readonly roles: Choice<DanceRole>[] = DANCE_ROLES.map((value) => ({ value, label: DANCE_ROLE_LABELS[value] }));
}
