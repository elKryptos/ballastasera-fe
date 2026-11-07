import { Component, computed, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { FEATURE_FLAGS } from '../../core/config/feature-flags';
import { ORGANIZER_TYPE_LABELS } from '../../core/config/organizer-types';
import { AuthService } from '../../core/services/auth.service';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { OrganizerRequestsService } from '../../core/services/organizer-requests.service';
import { OrganizersService } from '../../core/services/organizers.service';
import { instagramHandle } from '../../core/utils/event-format';
import { optionalInstagram } from '../../core/utils/form-validators';
import { initialOf } from '../../core/utils/initials';
import { REQUEST_URL, requestStatusOf } from '../../core/utils/organizer-request-status';
import { FormSave } from '../../core/utils/pending-action';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { InstagramInput } from '../../shared/instagram-input/instagram-input';
import { OrganizerAvatar } from '../../shared/organizer-avatar/organizer-avatar';
import { RequestField } from '../../shared/request-field/request-field';

/**
 * "Il tuo account", opened from the menu's profile card. Name, photo and email
 * come from Google and only show; Instagram and "Profilo visibile" are the two
 * things a user changes (PATCH /rest/auth/me). Below, the way to the page they
 * organize, or for a user the way to having one: the same request status the
 * menu's "Organizza" card tells (requestStatusOf).
 */
@Component({
  selector: 'app-account',
  imports: [ReactiveFormsModule, RouterLink, SidebarPushDirective, InstagramInput, OrganizerAvatar, RequestField],
  host: { class: 'block min-h-dvh bg-ground text-(--ev-text)' },
  templateUrl: './account.html',
})
export class Account {
  private readonly auth = inject(AuthService);
  private readonly organizers = inject(OrganizersService);
  private readonly requests = inject(OrganizerRequestsService);

  protected readonly user = this.auth.currentUser;
  protected readonly initial = computed(() => initialOf(this.user()?.displayName));

  /** Becoming an organizer, and the organizer's page, are behind the same flag as the request. */
  protected readonly organizerEnabled = inject(FeatureFlagService).isEnabled(FEATURE_FLAGS.organizerRequestPage);
  protected readonly organizer = this.organizers.myOrganizer;
  protected readonly organizerType = computed(() => {
    const organizer = this.organizer();
    return organizer ? ORGANIZER_TYPE_LABELS[organizer.type] : '';
  });
  /** Users only: an organizer or an admin has nothing to ask for. */
  protected readonly isUser = computed(() => this.user()?.role === 'USER');
  protected readonly requestStatus = computed(() => requestStatusOf(this.requests.myRequest()));
  protected readonly requestUrl = REQUEST_URL;

  protected readonly form = inject(NonNullableFormBuilder).group({
    instagram: [this.user()?.instagram ?? '', [optionalInstagram]],
    showProfilePublic: [this.user()?.showProfilePublic ?? false],
  });
  protected readonly saving = new FormSave(this.form);

  constructor() {
    // An admin may own a page too: anyone but a user, whose request says it all. An organizer's is
    // already kept, from the menu: no question then.
    if (this.organizerEnabled && !this.isUser()) {
      this.organizers.ensureMine().pipe(catchError(() => of(null))).subscribe();
    }
  }

  protected togglePublic(): void {
    const control = this.form.controls.showProfilePublic;
    control.setValue(!control.value);
    control.markAsDirty();
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { instagram, showProfilePublic } = this.form.getRawValue();
    this.saving.run(this.auth.updateMe({ instagram: instagramHandle(instagram), showProfilePublic }), {
      next: (user) => this.form.reset({ instagram: user.instagram ?? '', showProfilePublic: user.showProfilePublic }),
      errorMessage: () => 'Non siamo riusciti a salvare. Riprova tra poco.',
    });
  }

  protected logout(): void {
    this.auth.logout().subscribe();
  }
}
