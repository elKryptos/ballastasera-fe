import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, concatMap, map, of } from 'rxjs';
import { FEATURE_FLAGS, FeatureFlag } from '../../core/config/feature-flags';
import { ORGANIZER_TYPE_LABELS } from '../../core/config/organizer-types';
import { AuthService } from '../../core/services/auth.service';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { OrganizerRequestsService } from '../../core/services/organizer-requests.service';
import { OrganizersService } from '../../core/services/organizers.service';
import { UsersService } from '../../core/services/users.service';
import { controlValue, toggleControl } from '../../core/utils/form-controls';
import { initialOf } from '../../core/utils/initials';
import { REQUEST_URL, requestStatusOf } from '../../core/utils/organizer-request-status';
import { FormSave } from '../../core/utils/pending-action';
import { profileErrorMessage } from '../../core/utils/profile-errors';
import { ProfileFormValue, profileFormValue, sameProfile, toUserUpdate } from '../../core/utils/user-update';
import { normalizeUsername, usernameErrorMessage } from '../../core/utils/username';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { EmailNotificationsToggle } from '../../shared/email-notifications-toggle/email-notifications-toggle';
import { InstagramInput } from '../../shared/instagram-input/instagram-input';
import { OrganizerAvatar } from '../../shared/organizer-avatar/organizer-avatar';
import { RequestField } from '../../shared/request-field/request-field';
import { ToggleSwitch } from '../../shared/toggle-switch/toggle-switch';
import { AboutFields } from './about-fields/about-fields';
import { AvatarEditor } from './avatar-editor/avatar-editor';
import { BlockedPeople } from '../../shared/blocked-people/blocked-people';
import { DanceStylesField } from './dance-styles-field/dance-styles-field';
import { DancerFields } from './dancer-fields/dancer-fields';
import { PrivacyFields } from './privacy-fields/privacy-fields';
import { PROFILE_FORM, provideProfileForm } from './profile-form';
import { SchoolField } from './school-field/school-field';
import { WhatsappField } from './whatsapp-field/whatsapp-field';

interface AccountSection {
  id: string;
  label: string;
  /** Shown when any of these flags is on. */
  shownWith: readonly FeatureFlag[];
}

/** The page's sections, in order. The ids are the cards' (account.html). */
const ACCOUNT_SECTIONS: readonly AccountSection[] = [
  { id: 'account-about', label: 'Chi sei', shownWith: [FEATURE_FLAGS.social, FEATURE_FLAGS.dancerProfile] },
  { id: 'account-dance', label: 'Come balli', shownWith: [FEATURE_FLAGS.dancerProfile] },
  { id: 'account-contacts', label: 'Contatti', shownWith: [FEATURE_FLAGS.accountPage] },
  { id: 'account-privacy', label: 'Chi ti vede', shownWith: [FEATURE_FLAGS.accountPage] },
  { id: 'account-people', label: 'Avvisi e persone', shownWith: [FEATURE_FLAGS.social] },
];

/**
 * "Il tuo account", opened from the menu's profile card. Name, photo and email
 * come from Google and only show. "I tuoi dati" is what the user changes, saved
 * whole with one "Salva" (PATCH /rest/auth/me, see toUserUpdate): Instagram and
 * "Profilo visibile", and with the dancerProfile flag on the dancer's profile too
 * (WhatsApp, birth date, gender, role, styles with their level), from the canvas'
 * "Il tuo account" artboard. Below, the way to the page they organize, or for a
 * user the way to having one: the same request status the menu's "Organizza"
 * card tells (requestStatusOf). With the social features (docs/social-fe.md) it's
 * "Modifica profilo" (canvas 4b): the photo, saved at once; "Chi sei" (username,
 * bio, town, country of origin); the school; who sees the nights one goes to and
 * "Profilo pubblico"; "Ricevi email" and the people blocked, each saved on its own.
 *
 * Laid out in sections (ACCOUNT_SECTIONS), each a card with its title; on a wide screen their fields go
 * two to a row, and the photo, an index of the sections, the organizer's page and "Esci" stay in a
 * column on the left. While something's unsaved, "Annulla" and "Salva" stick to the screen's bottom.
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
    AboutFields,
    AvatarEditor,
    BlockedPeople,
    EmailNotificationsToggle,
    PrivacyFields,
    SchoolField,
  ],
  providers: [provideProfileForm()],
  host: { class: 'block min-h-dvh bg-ground text-(--ev-text)' },
  templateUrl: './account.html',
  styleUrl: './account.css',
})
export class Account {
  private readonly auth = inject(AuthService);
  private readonly organizers = inject(OrganizersService);
  private readonly requests = inject(OrganizerRequestsService);
  private readonly users = inject(UsersService);

  protected readonly user = this.auth.currentUser;
  protected readonly initial = computed(() => initialOf(this.user()?.displayName));

  private readonly flags = inject(FeatureFlagService);
  /** Becoming an organizer, and the organizer's page, are behind the same flag as the request. */
  protected readonly organizerEnabled = this.flags.isEnabled(FEATURE_FLAGS.organizerRequestPage);
  /** The dancer's profile fields. Off, they're still in the form, with the user's values, and
   * saved back unchanged: the backend would empty whatever wasn't sent. */
  protected readonly dancerProfileEnabled = this.flags.isEnabled(FEATURE_FLAGS.dancerProfile);
  /** The social fields (see the class's comment). Off, they're in the form too, saved back unchanged. */
  protected readonly socialEnabled = this.flags.isEnabled(FEATURE_FLAGS.social);
  protected readonly organizer = this.organizers.myOrganizer;
  protected readonly organizerType = computed(() => {
    const organizer = this.organizer();
    return organizer ? ORGANIZER_TYPE_LABELS[organizer.type] : '';
  });
  /** Users only: an organizer or an admin has nothing to ask for. */
  protected readonly isUser = computed(() => this.user()?.role === 'USER');
  protected readonly requestStatus = computed(() => requestStatusOf(this.requests.myRequest()));
  protected readonly requestUrl = REQUEST_URL;

  /** The sections the page has with these flags, for the index on the left (wide screens). */
  protected readonly sections: readonly AccountSection[] = ACCOUNT_SECTIONS.filter((section) =>
    section.shownWith.some((flag) => this.flags.isEnabled(flag)),
  );
  private readonly document = inject(DOCUMENT);

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
  /** Something to save, or being saved: "Annulla" and "Salva" stick to the screen's bottom. */
  protected readonly pending = computed(() => this.changed() || this.saving.busy());

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
    const value = this.form.getRawValue();
    const username = normalizeUsername(value.username) || null;
    const usernameChanged = this.socialEnabled && username !== (this.user()?.username ?? null);
    // The profile first, then the username on its own endpoint (S7): the profile's PATCH doesn't
    // carry it. "Salva" is disabled while saving (FormSave.busy): two PATCHes adding the same style
    // at once would make the backend fail on the second.
    const request = this.auth
      .updateMe(toUserUpdate(value))
      .pipe(
        concatMap((user) =>
          usernameChanged ? this.users.setUsername(username).pipe(map(() => ({ ...user, username }))) : of(user),
        ),
      );
    this.saving.run(request, {
      next: (user) => this.load(profileFormValue(user)),
      errorMessage: (error) => {
        const usernameMessage = usernameErrorMessage(error);
        if (!usernameMessage) return profileErrorMessage(error);
        // The profile was saved, the username wasn't: what's saved is the profile, and the name typed
        // stays in the field, as a change still to save.
        const saved = this.user();
        if (saved) this.load({ ...profileFormValue(saved), username: saved.username ?? '' }, value.username);
        return usernameMessage;
      },
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

  /** The profile as saved, in the form; `typedUsername` keeps a username the backend refused. */
  private load(value: ProfileFormValue, typedUsername?: string): void {
    this.lastSaved.set(value);
    this.form.reset(typedUsername === undefined ? value : { ...value, username: typedUsername });
  }

  /** The index: to the section, and the focus on it (tabindex -1), so the keyboard goes on from there.
   * A plain #fragment link would go to the home page, the app's <base href="/">. */
  protected jumpTo(id: string): void {
    const section = this.document.getElementById(id);
    if (!section) return;
    const still = this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;
    section.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    section.focus({ preventScroll: true });
  }

  protected logout(): void {
    this.auth.logout().subscribe();
  }
}
