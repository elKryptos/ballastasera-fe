import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck } from '@ng-icons/lucide';
import { BrnAlertDialogContent } from '@spartan-ng/brain/alert-dialog';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { AuthService } from '../../../../core/services/auth.service';
import { OrganizerRequestsService } from '../../../../core/services/organizer-requests.service';
import { requestErrorMessage } from '../../../../core/utils/organizer-request-errors';
import { requestDateLabel } from '../../../../core/utils/request-dates';

/** Shown right after sending, and whenever a user with a request in review
 * comes back to it. The guard lets only a PENDING request through. */
@Component({
  selector: 'app-richiesta-inviata',
  imports: [RouterLink, NgIcon, BrnAlertDialogContent, HlmAlertDialogImports, HlmButton],
  providers: [provideIcons({ lucideCheck })],
  host: { class: 'block' },
  templateUrl: './richiesta-inviata.html',
})
export class RichiestaInviata {
  private readonly requests = inject(OrganizerRequestsService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly request = this.requests.myRequest;
  protected readonly userName = computed(() => this.auth.currentUser()?.displayName ?? '');
  protected readonly cancelling = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  /** Told once, by the step that sent it: the request went, its logo didn't. */
  protected readonly logoFailed = !!this.router.currentNavigation()?.extras.state?.['logoFailed'];

  protected readonly timeline = computed(() => [
    { state: 'done', title: 'Richiesta inviata', text: requestDateLabel(this.request()?.submittedAt) },
    { state: 'current', title: 'In revisione', text: 'Di solito entro 48 ore' },
    { state: 'next', title: 'Pronto a pubblicare', text: 'Nel menu si apre la sezione Gestione' },
  ]);

  constructor() {
    // It left review while this was open, cancelled here or decided by the
    // admin: this page is over, and the menu's card says what happened.
    effect(() => {
      const request = this.request();
      if (request && request.status !== 'PENDING') this.router.navigateByUrl('/menu');
    });
  }

  protected cancel(): void {
    const request = this.request();
    if (!request || this.cancelling()) return;
    this.cancelling.set(true);
    this.errorMessage.set(null);

    this.requests.cancel(request.id).subscribe({
      error: (error) => {
        this.cancelling.set(false);
        this.errorMessage.set(requestErrorMessage(error));
      },
    });
  }
}
