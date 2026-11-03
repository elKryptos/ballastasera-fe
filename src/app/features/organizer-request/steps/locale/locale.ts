import { Component, computed, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideInfo, lucideMapPin } from '@ng-icons/lucide';
import { isVenueBound } from '../../../../core/config/organizer-types';
import { OrganizerRequestFormStore, requestStepUrl } from '../../organizer-request-form.store';
import { RequestField } from '../../../../shared/request-field/request-field';
import { RequestStepShell } from '../../request-step/request-step';

/** "Il tuo locale": only for a new profile of a type with a venue. The admin
 * creates the venue from this address when approving. */
@Component({
  selector: 'app-request-locale',
  imports: [ReactiveFormsModule, NgIcon, RequestField, RequestStepShell],
  providers: [provideIcons({ lucideChevronDown, lucideInfo, lucideMapPin })],
  host: { class: 'block' },
  templateUrl: './locale.html',
})
export class Locale {
  protected readonly store = inject(OrganizerRequestFormStore);
  private readonly router = inject(Router);

  protected readonly controls = this.store.locale.controls;
  protected readonly profileName = this.store.profile.controls.name.value;
  /** A school may also publish elsewhere: the note is only for clubs and bars. */
  protected readonly showVenueBoundNote = computed(() => {
    const type = this.store.organizerType();
    return type !== null && isVenueBound(type);
  });

  protected next(): void {
    if (this.store.validate('locale')) {
      this.router.navigateByUrl(requestStepUrl(this.store.nextStep('locale')));
    }
  }
}
