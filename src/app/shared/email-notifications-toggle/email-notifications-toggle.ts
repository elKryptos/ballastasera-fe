import { Component, computed, inject, linkedSignal } from '@angular/core';
import { EMAIL_NOTIFICATIONS_TEXT } from '../../core/config/social';
import { AuthService } from '../../core/services/auth.service';
import { UsersService } from '../../core/services/users.service';
import { PendingAction } from '../../core/utils/pending-action';
import { ToggleSwitch } from '../toggle-switch/toggle-switch';

let nextId = 0;

/**
 * "Ricevi email" (social phase 6): saved at a tap, on its own endpoint, apart from the profile's
 * "Salva" (an older page would otherwise switch it off). Says "Salvato", or puts the switch back if
 * it failed. In "Il tuo account", where the emails' link leads, and in the bell's page.
 */
@Component({
  selector: 'app-email-notifications-toggle',
  imports: [ToggleSwitch],
  templateUrl: './email-notifications-toggle.html',
})
export class EmailNotificationsToggle {
  private readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);

  protected readonly labelId = `email-notifications-${++nextId}`;
  protected readonly text = EMAIL_NOTIFICATIONS_TEXT;
  /** The session's value (true for everyone at first), and the taps since. */
  protected readonly enabled = linkedSignal(() => this.auth.currentUser()?.emailNotifications ?? true);
  protected readonly saving = new PendingAction();
  protected readonly saved = linkedSignal<boolean, boolean>({ source: () => this.enabled(), computation: () => false });
  protected readonly status = computed(() => (this.saving.busy() ? 'Salvataggio…' : this.saved() ? 'Salvato' : null));

  protected toggle(): void {
    const enabled = !this.enabled();
    this.enabled.set(enabled);
    this.saving.run(this.users.setEmailNotifications(enabled), {
      complete: () => this.saved.set(true),
      errorMessage: () => {
        this.enabled.set(!enabled);
        return 'Non siamo riusciti a salvarlo. Riprova tra poco.';
      },
    });
  }
}
