import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BrnAlertDialogContent } from '@spartan-ng/brain/alert-dialog';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { catchError, finalize, of, switchMap } from 'rxjs';
import { FEATURE_FLAGS } from '../../core/config/feature-flags';
import { ORGANIZER_TYPE_LABELS } from '../../core/config/organizer-types';
import { OrganizerDetailDto, OrganizerOwnerUpdateDto } from '../../core/models/organizer.model';
import { VenuesSummaryDto } from '../../core/models/venue.model';
import { AuthService } from '../../core/services/auth.service';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { OrganizersService } from '../../core/services/organizers.service';
import { instagramHandle } from '../../core/utils/event-format';
import { WEBSITE_PATTERN, notBlank, optionalInstagram } from '../../core/utils/form-validators';
import { requestErrorMessage } from '../../core/utils/organizer-request-errors';
import { FormSave, PendingAction } from '../../core/utils/pending-action';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { InstagramInput } from '../../shared/instagram-input/instagram-input';
import { LogoPicker } from '../../shared/logo-picker/logo-picker';
import { RequestField } from '../../shared/request-field/request-field';

/** The request's wording for a 403 or a 404 doesn't fit a page that's already theirs. */
const PROFILE_ERRORS: Record<number, string> = {
  403: 'Questa pagina non è più tua: ricarica.',
  404: 'Questa pagina non esiste più.',
};
const profileErrorMessage = (error: unknown) => requestErrorMessage(error, PROFILE_ERRORS);

/** The one way out of a page (D13 and D15), and how it's worded. */
const EXITS = {
  delete: {
    title: 'Elimina la pagina',
    text: 'La pagina e il logo spariscono. Le serate in programma vengono annullate e le serie disattivate.',
    confirmVerb: 'Eliminare',
    confirmText: 'Le serate future verranno annullate e le serie disattivate. Non si può tornare indietro.',
    confirmAction: 'Elimina',
  },
  release: {
    title: 'Lascia la pagina',
    text: 'La pagina, il logo, il locale e le serate restano pubblicati. Non sarai più tu a gestirla.',
    confirmVerb: 'Lasciare',
    confirmText: 'I contatti e le serate resteranno pubblici: se serve, modificali prima.',
    confirmAction: 'Lascia la pagina',
  },
} as const;

/** The form's fields, as the backend has them. Every one goes back, an emptied one as "":
 * the backend skips nulls, so a null would leave the old value. */
function formValueOf(organizer: OrganizerDetailDto): OrganizerOwnerUpdateDto {
  return {
    name: organizer.name,
    description: organizer.description ?? '',
    instagram: organizer.instagram ?? '',
    contactEmail: organizer.contactEmail ?? '',
    phone: organizer.phone ?? '',
    website: organizer.website ?? '',
    facebook: organizer.facebook ?? '',
  };
}

/** What's typed, as it's saved: trimmed, and Instagram as a bare handle. */
function bodyOf(value: OrganizerOwnerUpdateDto): OrganizerOwnerUpdateDto {
  const trimmed = Object.fromEntries(
    Object.entries(value).map(([key, text]) => [key, text.trim()]),
  ) as OrganizerOwnerUpdateDto;
  return { ...trimmed, instagram: instagramHandle(value.instagram) };
}

/**
 * "La tua pagina": the owner edits the organizer's page (PATCH /rest/organizers/{id}),
 * changes its logo (PATCH …/logo, at once, apart from the form) and sees its venues,
 * which only the admin links (D11). At the bottom one way out (D13 and D15): "Elimina"
 * for a page they created with a request (claimed false), "Lascia la pagina" for one
 * they claimed. From the account page.
 */
@Component({
  selector: 'app-organizer-profile',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    SidebarPushDirective,
    InstagramInput,
    LogoPicker,
    RequestField,
    BrnAlertDialogContent,
    HlmAlertDialogImports,
  ],
  host: { class: 'block min-h-dvh bg-ground text-(--ev-text)' },
  templateUrl: './organizer-profile.html',
})
export class OrganizerProfile {
  private readonly organizers = inject(OrganizersService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly organizer = this.organizers.myOrganizer;
  protected readonly loaded = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly venues = signal<VenuesSummaryDto[]>([]);
  protected readonly typeLabel = computed(() => {
    const organizer = this.organizer();
    return organizer ? ORGANIZER_TYPE_LABELS[organizer.type] : '';
  });
  /** D15: claimed is "it came through a CLAIM". Those are left, the owner's own are deleted. */
  private readonly createdByOwner = computed(() => this.organizer()?.claimed === false);
  protected readonly exit = computed(() => (this.createdByOwner() ? EXITS.delete : EXITS.release));
  /** Back to the account, or to the menu while the account page is off. */
  protected readonly back = inject(FeatureFlagService).isEnabled(FEATURE_FLAGS.accountPage)
    ? { url: '/il-tuo-account', label: 'Il tuo account' }
    : { url: '/menu', label: 'Menu' };

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [notBlank, Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(2000)]],
    instagram: ['', [optionalInstagram]],
    contactEmail: ['', [Validators.email, Validators.maxLength(100)]],
    phone: ['', [Validators.maxLength(20)]],
    website: ['', [Validators.maxLength(100), Validators.pattern(WEBSITE_PATTERN)]],
    facebook: ['', [Validators.maxLength(100)]],
  });
  protected readonly saving = new FormSave(this.form);
  protected readonly logoUpload = new PendingAction();
  protected readonly leaving = new PendingAction();

  constructor() {
    this.load();
  }

  protected save(): void {
    const organizer = this.organizer();
    if (!organizer) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.run(this.organizers.update(organizer.id, bodyOf(this.form.getRawValue())), {
      next: (updated) => this.form.reset(formValueOf(updated)),
      errorMessage: profileErrorMessage,
    });
  }

  protected changeLogo(file: File): void {
    const organizer = this.organizer();
    if (!organizer) return;
    this.logoUpload.run(this.organizers.uploadLogo(organizer.id, file), {
      errorMessage: () => 'Il logo non è stato caricato. Prova con un PNG o un JPG più leggero.',
    });
  }

  /** "Elimina" or "Lascia la pagina": either way the role may drop to USER, which only the session
   * says, so it's read again. The request isn't: neither changes it, and an approved one reads as
   * the invitation for a user (the menu's "Organizza" card). */
  protected leave(): void {
    const organizer = this.organizer();
    if (!organizer) return;
    const leaving = this.createdByOwner()
      ? this.organizers.delete(organizer.id)
      : this.organizers.release(organizer.id);
    this.leaving.run(leaving.pipe(switchMap(() => this.auth.restoreSession())), {
      complete: () => this.router.navigateByUrl('/menu'),
      errorMessage: profileErrorMessage,
    });
  }

  /** The page as it's kept (the menu loads it), else asked for; its venues on every visit. */
  private load(): void {
    this.organizers
      .ensureMine()
      .pipe(
        switchMap((organizer) => {
          if (!organizer) return of([]);
          this.form.reset(formValueOf(organizer));
          return this.organizers.getVenues(organizer.id).pipe(catchError(() => of([])));
        }),
        finalize(() => this.loaded.set(true)),
      )
      .subscribe({
        next: (venues) => this.venues.set(venues),
        error: () => this.loadFailed.set(true),
      });
  }
}
