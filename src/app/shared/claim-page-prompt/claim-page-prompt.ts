import { Component, PLATFORM_ID, computed, inject, input, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBadgeCheck } from '@ng-icons/lucide';
import { FEATURE_FLAGS } from '../../core/config/feature-flags';
import { AuthService } from '../../core/services/auth.service';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { claimRequestUrl } from '../../core/utils/organizer-request-status';
import { AuthModal } from '../auth-modal/auth-modal';

/**
 * "È la tua pagina?" under a page nobody owns yet (the night's organizer, the
 * venue's): its owner claims it and publishes their nights themselves. The
 * parent shows it only for a claimable page; it shows itself only to who could
 * ask — signed out, or a plain user (an organizer already has their one page,
 * MAX_ORGANIZERS_PER_USER). Signed out, the login comes first and lands on the
 * request's steps with the page picked (claimLinkGuard).
 */
@Component({
  selector: 'app-claim-page-prompt',
  imports: [NgIcon, AuthModal],
  providers: [provideIcons({ lucideBadgeCheck })],
  // empty:hidden: hidden from who can't claim, it takes the parent's border and gap with it.
  host: { class: 'block empty:hidden' },
  templateUrl: './claim-page-prompt.html',
})
export class ClaimPagePrompt {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly enabled = inject(FeatureFlagService).isEnabled(FEATURE_FLAGS.organizerRequestPage);
  /** Never on the server: signed out there, it would render for everyone, flash for an organizer or
   * admin until hydration took it away, and end up in the night's search snippet. */
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly name = input.required<string>();
  readonly slug = input.required<string>();

  protected readonly visible = computed(() => {
    const role = this.auth.currentUser()?.role;
    return this.isBrowser && this.enabled && (!role || role === 'USER');
  });
  protected readonly claimUrl = computed(() => claimRequestUrl(this.slug()));
  protected readonly authText = computed(
    () => `Accedi con il tuo account Google per rivendicare ${this.name()}: poi ti chiediamo solo come verificare che è tua. Niente password da ricordare.`,
  );
  protected readonly authOpen = signal(false);

  protected claim(): void {
    if (!this.auth.isAuthenticated()) {
      this.authOpen.set(true);
      return;
    }
    this.router.navigateByUrl(this.claimUrl());
  }
}
