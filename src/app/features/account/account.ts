import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { FEATURE_FLAGS } from '../../core/config/feature-flags';
import { ORGANIZER_TYPE_LABELS } from '../../core/config/organizer-types';
import { AuthService } from '../../core/services/auth.service';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { OrganizerRequestsService } from '../../core/services/organizer-requests.service';
import { OrganizersService } from '../../core/services/organizers.service';
import { controlValue, toggleControl } from '../../core/utils/form-controls';
import { initialOf } from '../../core/utils/initials';
import { REQUEST_URL, requestStatusOf } from '../../core/utils/organizer-request-status';
import { FormSave } from '../../core/utils/pending-action';
import { profileErrorMessage } from '../../core/utils/profile-errors';
import { ProfileFormValue, profileFormValue, sameProfile, toUserUpdate } from '../../core/utils/user-update';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { InstagramInput } from '../../shared/instagram-input/instagram-input';
import { OrganizerAvatar } from '../../shared/organizer-avatar/organizer-avatar';
import { RequestField } from '../../shared/request-field/request-field';
import { ToggleSwitch } from '../../shared/toggle-switch/toggle-switch';
import { DanceStylesField } from './dance-styles-field/dance-styles-field';
import { DancerFields } from './dancer-fields/dancer-fields';
import { PROFILE_FORM, provideProfileForm } from './profile-form';
import { WhatsappField } from './whatsapp-field/whatsapp-field';

/**
 * "Il tuo account", opened from the menu's profile card. Name, photo and email
 * come from Google and only show. "I tuoi dati" is what the user changes, saved
 * whole with one "Salva" (PATCH /rest/auth/me, see toUserUpdate): Instagram and
 * "Profilo visibile", and with the dancerProfile flag on the dancer's profile too
 * (WhatsApp, birth date, gender, role, styles with their level), from the canvas'
 * "Il tuo account" artboard. Below, the way to the page they organize, or for a
 * user the way to having one: the same request status the menu's "Organizza"
 * card tells (requestStatusOf).
 */
@Component({
  selector: 'app-account',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    SidebarPushDirective,
    InstagramInput,
    OrganizerAvatar,
    RequestField,
    ToggleSwitch,
    WhatsappField,
    DancerFields,
    DanceStylesField,
  ],
  providers: [provideProfileForm()],
  host: { class: 'block min-h-dvh bg-ground text-(--ev-text)' },
  templateUrl: './account.html',
})
export class Account {
  private readonly auth = inject(AuthService);
  private readonly organizers = inject(OrganizersService);
  private readonly requests = inject(OrganizerRequestsService);

  protected readonly user = this.auth.currentUser;
  protected readonly initial = computed(() => initialOf(this.user()?.displayName));

  private readonly flags = inject(FeatureFlagService);
  /** Becoming an organizer, and the organizer's page, are behind the same flag as the request. */
  protected readonly organizerEnabled = this.flags.isEnabled(FEATURE_FLAGS.organizerRequestPage);
  /** The dancer's profile fields. Off, they're still in the form, with the user's values, and
   * saved back unchanged: the backend would empty whatever wasn't sent. */
  protected readonly dancerProfileEnabled = this.flags.isEnabled(FEATURE_FLAGS.dancerProfile);
  protected readonly organizer = this.organizers.myOrganizer;
  protected readonly organizerType = computed(() => {
    const organizer = this.organizer();
    return organizer ? ORGANIZER_TYPE_LABELS[organizer.type] : '';
  });
  /** Users only: an organizer or an admin has nothing to ask for. */
  protected readonly isUser = computed(() => this.user()?.role === 'USER');
  protected readonly requestStatus = computed(() => requestStatusOf(this.requests.myRequest()));
  protected readonly requestUrl = REQUEST_URL;

  protected readonly form = inject(PROFILE_FORM);
  protected readonly isPublic = controlValue(this.form.controls.showProfilePublic);
  protected readonly saving = new FormSave(this.form);
  /** The profile as last loaded or saved: what "Annulla" puts back, and what tells whether there's
   * anything to save. */
  private readonly lastSaved = signal<ProfileFormValue | null>(null);
  /** A signal, since the field groups change the form from their own components, which wouldn't
   * refresh this one's template. */
  private readonly formValue = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });
  /** The form would save something different from what's saved: "Salva" and "Annulla" show. Not
   * the form's dirty flag: a field changed and put back is no change (see sameProfile). */
  protected readonly changed = computed(() => {
    const saved = this.lastSaved();
    return saved !== null && !sameProfile(this.formValue(), saved);
  });

  constructor() {
    const user = this.user();
    if (user) this.load(profileFormValue(user));

    // An admin may own a page too: anyone but a user, whose request says it all. An organizer's is
    // already kept, from the menu: no question then.
    if (this.organizerEnabled && !this.isUser()) {
      this.organizers.ensureMine().pipe(catchError(() => of(null))).subscribe();
    }
  }

  protected togglePublic(): void {
    toggleControl(this.form.controls.showProfilePublic);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    // "Salva" is disabled while saving (FormSave.busy): two PATCHes adding the same style at
    // once would make the backend fail on the second.
    this.saving.run(this.auth.updateMe(toUserUpdate(this.form.getRawValue())), {
      next: (user) => this.load(profileFormValue(user)),
      errorMessage: profileErrorMessage,
    });
  }

  /** "Annulla": back to the profile as it was last saved. */
  protected discard(): void {
    const saved = this.lastSaved();
    if (!saved) return;
    this.form.reset(saved);
    // A failed save's message is about changes that are gone now.
    this.saving.error.set(null);
  }

  private load(value: ProfileFormValue): void {
    this.lastSaved.set(value);
    this.form.reset(value);
  }

  protected logout(): void {
    this.auth.logout().subscribe();
  }
}
