import { Service, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, Validators } from '@angular/forms';
import { catchError, map, of, startWith, switchMap, take } from 'rxjs';
import { requiresVenue } from '../../core/config/organizer-types';
import { CityDto } from '../../core/models/city.model';
import { OrganizerRequestCreateDto, OrganizerRequestDto, OrganizerRequestType } from '../../core/models/organizer-request.model';
import { OrganizerSummaryDto, OrganizerType } from '../../core/models/organizer.model';
import { AuthService } from '../../core/services/auth.service';
import { CitiesService } from '../../core/services/cities.service';
import { OrganizersService } from '../../core/services/organizers.service';
import { instagramHandle } from '../../core/utils/event-format';
import { WEBSITE_PATTERN, notBlank, validInstagram } from '../../core/utils/form-validators';
import { REQUEST_URL } from '../../core/utils/organizer-request-status';

export type RequestStep = 'chi-sei' | 'profilo' | 'locale' | 'conferma';

/** The organizer a CLAIM asks for. A resubmitted request only knows these. */
export type ClaimTarget = Pick<OrganizerSummaryDto, 'id' | 'name' | 'slug' | 'type' | 'logoUrl'>;

export function requestStepUrl(step: RequestStep | 'richiesta-inviata'): string {
  return `${REQUEST_URL}/${step}`;
}

/** A form's validity as a signal, for the templates and computeds that read it. */
function validSignal(control: AbstractControl) {
  return toSignal(control.statusChanges.pipe(map(() => control.valid)), { initialValue: control.valid });
}

function blankToUndefined(value: string): string | undefined {
  return value.trim() || undefined;
}

/**
 * The draft of a request while the user moves through the wizard's steps, and
 * the rules on which steps it has: the steps' components only show it. Provided
 * on the wizard's parent route, so it outlives each step and the guards can
 * read it.
 */
@Service({ autoProvided: false })
export class OrganizerRequestFormStore {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly citiesService = inject(CitiesService);
  private readonly organizers = inject(OrganizersService);

  readonly organizerType = signal<OrganizerType | null>(null);
  readonly claimTarget = signal<ClaimTarget | null>(null);
  private readonly creatingNew = signal(false);
  /** What's typed in the search, kept for coming back to it. */
  readonly searchQuery = signal('');
  readonly logoFile = signal<File | null>(null);
  readonly logoPreviewUrl = signal<string | null>(null);
  /** The rejected request this draft started from, if any. Its logo went with the rejection. */
  readonly resubmittedFromId = signal<string | null>(null);
  private draftOwnerId: string | null = null;

  /** Both kinds of request prove the same way. */
  readonly contact = this.fb.group({
    instagram: ['', [validInstagram]],
    contactEmail: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
  });
  readonly claim = this.fb.group({
    message: ['', [Validators.maxLength(500)]],
  });
  readonly profile = this.fb.group({
    name: ['', [notBlank, Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(500)]],
    phone: ['', [Validators.maxLength(20)]],
    website: ['', [Validators.maxLength(100), Validators.pattern(WEBSITE_PATTERN)]],
  });
  readonly locale = this.fb.group({
    venueAddress: ['', [notBlank, Validators.maxLength(150)]],
    venueCityId: this.fb.control<number | null>(null, Validators.required),
  });
  readonly termsAccepted = this.fb.control(false, Validators.requiredTrue);

  private readonly contactValid = validSignal(this.contact);
  private readonly claimValid = validSignal(this.claim);
  private readonly profileValid = validSignal(this.profile);
  private readonly localeValid = validSignal(this.locale);
  readonly termsValid = validSignal(this.termsAccepted);

  /** Null until the user picks an organizer or goes for a new one. */
  readonly mode = computed<OrganizerRequestType | null>(() => {
    if (this.claimTarget()) return 'CLAIM';
    return this.creatingNew() ? 'NEW' : null;
  });

  /** "Il tuo locale" exists only for a new profile of a type with a venue:
   * a claimed page already comes with its own. */
  readonly needsLocale = computed(() => {
    const type = this.organizerType();
    return this.mode() === 'NEW' && type !== null && requiresVenue(type);
  });

  readonly steps = computed<RequestStep[]>(() =>
    this.needsLocale() ? ['chi-sei', 'profilo', 'locale', 'conferma'] : ['chi-sei', 'profilo', 'conferma'],
  );

  /** The step to go back to if the draft doesn't reach the one asked for. */
  readonly firstIncompleteStep = computed<RequestStep>(
    () => this.steps().find((step) => !this.isComplete(step)) ?? 'conferma',
  );

  readonly cities = toSignal(
    this.citiesService.getCities().pipe(catchError(() => of<CityDto[]>([]))),
    { initialValue: [] },
  );

  private readonly localeValue = toSignal(this.locale.valueChanges.pipe(map(() => this.locale.getRawValue())), {
    initialValue: this.locale.getRawValue(),
  });

  readonly venueCityName = computed(
    () => this.cities().find((city) => city.id === this.localeValue().venueCityId)?.name ?? null,
  );
  readonly venueAddress = computed(() => this.localeValue().venueAddress);

  /** The claimed page's description and venues, for its card and the summary.
   * Null while loading, or if they don't load: the wizard goes on without them. */
  readonly claimDetails = toSignal(
    toObservable(this.claimTarget).pipe(
      switchMap((target) =>
        !target
          ? of(null)
          : this.organizers.getWithVenues(target).pipe(
              catchError(() => of(null)),
              startWith(null),
            ),
      ),
    ),
    { initialValue: null },
  );

  constructor() {
    this.reset();
  }

  /** The draft belongs to whoever started it: another user signing in on the same tab starts clean. */
  ensureOwnDraft(): void {
    if (this.draftOwnerId !== (this.auth.currentUser()?.userId ?? null)) this.reset();
  }

  reset(): void {
    const user = this.auth.currentUser();
    this.draftOwnerId = user?.userId ?? null;
    this.organizerType.set(null);
    this.claimTarget.set(null);
    this.creatingNew.set(false);
    this.searchQuery.set('');
    this.resubmittedFromId.set(null);
    this.clearLogo();
    this.contact.reset({ instagram: '', contactEmail: user?.email ?? '' });
    this.claim.reset();
    this.profile.reset();
    this.locale.reset();
    this.termsAccepted.reset();
  }

  selectClaim(organizer: ClaimTarget): void {
    this.creatingNew.set(false);
    this.claimTarget.set(organizer);
  }

  /** The name they searched for, not found, is likely the new profile's. */
  startNew(name: string): void {
    this.claimTarget.set(null);
    this.creatingNew.set(true);
    if (!this.profile.controls.name.value) this.profile.controls.name.setValue(name);
  }

  backToSearch(): void {
    this.claimTarget.set(null);
    this.creatingNew.set(false);
  }

  setLogo(file: File): void {
    this.clearLogo();
    this.logoFile.set(file);
    this.logoPreviewUrl.set(URL.createObjectURL(file));
  }

  /** "Modifica e reinvia": a new draft from a rejected request. Its logo was deleted with the rejection. */
  prefillFrom(request: OrganizerRequestDto): void {
    this.reset();
    this.resubmittedFromId.set(request.id);
    this.organizerType.set(request.organizerType);
    this.contact.patchValue({ instagram: request.instagram, contactEmail: request.contactEmail });

    if (request.type === 'CLAIM') {
      this.claim.patchValue({ message: request.message ?? '' });
      // Without a slug the page is gone (ON DELETE SET NULL): they search again.
      if (request.organizerId && request.organizerSlug && request.organizerType) {
        this.selectClaim({
          id: request.organizerId,
          name: request.organizerName,
          slug: request.organizerSlug,
          type: request.organizerType,
          logoUrl: null,
        });
      }
      return;
    }

    this.creatingNew.set(true);
    this.profile.patchValue({
      name: request.organizerName,
      description: request.description ?? '',
      phone: request.phone ?? '',
      website: request.website ?? '',
    });
    this.locale.patchValue({ venueAddress: request.venueAddress ?? '' });
    // The request only has the city's name, the form wants its id.
    this.citiesService.getCities().pipe(take(1), catchError(() => of<CityDto[]>([]))).subscribe((cities) => {
      const city = cities.find((c) => c.name === request.venueCityName);
      if (city) this.locale.patchValue({ venueCityId: city.id });
    });
  }

  canEnter(step: RequestStep): boolean {
    const steps = this.steps();
    return steps.includes(step) && steps.indexOf(step) <= steps.indexOf(this.firstIncompleteStep());
  }

  nextStep(step: RequestStep): RequestStep {
    const steps = this.steps();
    return steps[Math.min(steps.indexOf(step) + 1, steps.length - 1)];
  }

  previousStep(step: RequestStep): RequestStep | null {
    const steps = this.steps();
    return steps[steps.indexOf(step) - 1] ?? null;
  }

  /** Whether the user may leave this step; if not, its errors start showing. */
  validate(step: RequestStep): boolean {
    this.formsOf(step).forEach((form) => form.markAllAsTouched());
    return this.isComplete(step);
  }

  toCreateDto(): OrganizerRequestCreateDto {
    const contact = this.contact.getRawValue();
    const proof = {
      instagram: instagramHandle(contact.instagram),
      contactEmail: contact.contactEmail.trim(),
      termsAccepted: this.termsAccepted.value,
    };

    const target = this.claimTarget();
    if (target) {
      return {
        ...proof,
        type: 'CLAIM',
        targetOrganizerId: target.id,
        message: blankToUndefined(this.claim.controls.message.value),
      };
    }

    const profile = this.profile.getRawValue();
    const locale = this.locale.getRawValue();
    return {
      ...proof,
      type: 'NEW',
      name: profile.name.trim(),
      organizerType: this.organizerType() ?? undefined,
      description: blankToUndefined(profile.description),
      phone: blankToUndefined(profile.phone),
      website: blankToUndefined(profile.website),
      ...(this.needsLocale() ? { venueAddress: locale.venueAddress.trim(), venueCityId: locale.venueCityId ?? undefined } : {}),
    };
  }

  private isComplete(step: RequestStep): boolean {
    switch (step) {
      case 'chi-sei':
        return this.organizerType() !== null;
      case 'profilo':
        if (this.mode() === 'CLAIM') return this.contactValid() && this.claimValid();
        return this.mode() === 'NEW' && this.contactValid() && this.profileValid();
      case 'locale':
        return this.localeValid();
      case 'conferma':
        return false;
    }
  }

  private formsOf(step: RequestStep): AbstractControl[] {
    switch (step) {
      case 'profilo':
        return this.mode() === 'CLAIM' ? [this.contact, this.claim] : [this.contact, this.profile];
      case 'locale':
        return [this.locale];
      default:
        return [];
    }
  }

  private clearLogo(): void {
    const preview = this.logoPreviewUrl();
    if (preview) URL.revokeObjectURL(preview);
    this.logoFile.set(null);
    this.logoPreviewUrl.set(null);
  }
}
