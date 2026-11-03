import { Component, computed, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ClaimPageCard } from '../../claim-page-card/claim-page-card';
import { ContactFields } from '../../contact-fields/contact-fields';
import { NewProfileFields } from '../../new-profile-fields/new-profile-fields';
import { OrganizerRequestFormStore, requestStepUrl } from '../../organizer-request-form.store';
import { OrganizerSearch } from '../../organizer-search/organizer-search';
import { RequestField } from '../../../../shared/request-field/request-field';
import { RequestStepShell } from '../../request-step/request-step';

/** Step 2: search first. Picking a page asks only for the proof that it's
 * theirs (CLAIM); not finding it, for a whole new profile (NEW). */
@Component({
  selector: 'app-request-profilo',
  imports: [ReactiveFormsModule, ClaimPageCard, ContactFields, NewProfileFields, OrganizerSearch, RequestField, RequestStepShell],
  host: { class: 'block' },
  templateUrl: './profilo.html',
})
export class Profilo {
  protected readonly store = inject(OrganizerRequestFormStore);
  private readonly router = inject(Router);

  protected readonly lead = computed(() =>
    this.store.mode() === 'NEW'
      ? 'Non eri nella lista: crea la tua pagina. È quella che vedono i ballerini, potrai cambiarla quando vuoi.'
      : "Forse sei già su ballastasera. Cerca il tuo nome: se c'è, rivendica la pagina e le serate già pubblicate passano a te.",
  );

  protected next(): void {
    if (this.store.validate('profilo')) {
      this.router.navigateByUrl(requestStepUrl(this.store.nextStep('profilo')));
    }
  }
}
