import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideDisc3, lucideGraduationCap, lucideMartini, lucideUser, lucideUsers } from '@ng-icons/lucide';
import { ORGANIZER_TYPE_LABELS } from '../../../../core/config/organizer-types';
import { OrganizerType } from '../../../../core/models/organizer.model';
import { OrganizerRequestsService } from '../../../../core/services/organizer-requests.service';
import { OrganizerRequestFormStore, requestStepUrl } from '../../organizer-request-form.store';
import { RequestStepShell } from '../../request-step/request-step';

interface TypeOption {
  type: OrganizerType;
  hint: string;
  icon: string;
  tone: string;
}

const TYPE_OPTIONS: TypeOption[] = [
  { type: 'PERSON', hint: 'Organizzi serate a tuo nome', icon: 'lucideUser', tone: 'bg-rose/15 text-rose' },
  { type: 'SCHOOL', hint: 'Corsi, stage e serate della scuola', icon: 'lucideGraduationCap', tone: 'bg-violet/25 text-violet' },
  { type: 'CLUB', hint: 'Serate e party nel tuo club', icon: 'lucideDisc3', tone: 'bg-(--ev-zone-on-bg) text-(--ev-zone-on-text)' },
  { type: 'VENUE', hint: 'Un locale dove si balla', icon: 'lucideMartini', tone: 'bg-amber/15 text-amber' },
  { type: 'ASSOCIATION', hint: 'ASD, circolo o collettivo', icon: 'lucideUsers', tone: 'bg-blue-500/15 text-blue-500' },
];

/** Step 1. Also where "Modifica e reinvia" lands, with ?da=<rejected request's id>. */
@Component({
  selector: 'app-request-chi-sei',
  imports: [NgIcon, RequestStepShell],
  providers: [provideIcons({ lucideDisc3, lucideGraduationCap, lucideMartini, lucideUser, lucideUsers })],
  host: { class: 'block' },
  templateUrl: './chi-sei.html',
})
export class ChiSei {
  protected readonly store = inject(OrganizerRequestFormStore);
  private readonly router = inject(Router);

  protected readonly options = TYPE_OPTIONS;
  protected readonly typeLabels = ORGANIZER_TYPE_LABELS;

  constructor() {
    const rejectedId = inject(ActivatedRoute).snapshot.queryParamMap.get('da');
    const request = inject(OrganizerRequestsService).myRequest();
    if (request?.id === rejectedId && request?.status === 'REJECTED' && this.store.resubmittedFromId() !== rejectedId) {
      this.store.prefillFrom(request);
    }
  }

  protected next(): void {
    this.router.navigateByUrl(requestStepUrl(this.store.nextStep('chi-sei')));
  }
}
