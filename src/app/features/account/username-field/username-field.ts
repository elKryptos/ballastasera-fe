import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { Observable, catchError, concat, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { SITE_HOST, USERNAME_MAX } from '../../../core/config/social';
import { AuthService } from '../../../core/services/auth.service';
import { UsersService } from '../../../core/services/users.service';
import { controlValue } from '../../../core/utils/form-controls';
import {
  USERNAME_EMPTY_TEXT,
  USERNAME_ISSUE_TEXTS,
  normalizeUsername,
  usernameFromInstagram,
  usernameIssue,
  usernameLink,
} from '../../../core/utils/username';
import { PROFILE_FORM } from '../profile-form';

/** How long typing pauses before the backend is asked whether a name is free. */
const CHECK_DEBOUNCE_MS = 400;

type Availability = 'idle' | 'checking' | 'free' | 'taken' | 'reserved' | 'unknown';

/**
 * "Nome utente" (canvas 4b, social phase 7): the @name of the profile's short link, optional. Typed
 * the way it's kept (lower case, no @ nor spaces), checked against the backend's rules here and,
 * once they're met, asked whether it's free (debounced). A name someone else has stops "Salva".
 * Empty, it suggests the Instagram handle when that one is free. Saved with the form's "Salva", on
 * its own endpoint (see Account.save).
 */
@Component({
  selector: 'app-username-field',
  imports: [ReactiveFormsModule],
  templateUrl: './username-field.html',
  styleUrl: './username-field.css',
})
export class UsernameField {
  private readonly form = inject(PROFILE_FORM);
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);

  protected readonly control = this.form.controls.username;
  protected readonly maxLength = USERNAME_MAX;
  protected readonly prefix = `${SITE_HOST}/@`;

  private readonly value = controlValue(this.control);
  private readonly instagram = controlValue(this.form.controls.instagram);
  private readonly username = computed(() => normalizeUsername(this.value()));
  private readonly saved = computed(() => this.auth.currentUser()?.username ?? '');
  private readonly issue = computed(() => usernameIssue(this.username()));
  protected readonly availability = signal<Availability>('idle');

  /** The Instagram handle, offered while the field's empty and that name is free. */
  protected readonly suggestion = signal<string | null>(null);

  protected readonly invalid = computed(
    () => !!this.issue() || this.availability() === 'taken' || this.availability() === 'reserved',
  );

  protected readonly hint = computed(() => {
    const username = this.username();
    const issue = this.issue();
    if (!username) return USERNAME_EMPTY_TEXT;
    if (issue) return USERNAME_ISSUE_TEXTS[issue];
    if (username === this.saved()) return `Il tuo link: ${usernameLink(username)}`;
    switch (this.availability()) {
      case 'checking':
        return 'Controllo se è libero…';
      case 'free':
        return `Disponibile: ${usernameLink(username)}`;
      case 'taken':
        return USERNAME_ISSUE_TEXTS.taken;
      case 'reserved':
        return USERNAME_ISSUE_TEXTS.reserved;
      default:
        return `Il tuo link sarà ${usernameLink(username)}`;
    }
  });

  constructor() {
    toObservable(this.username)
      .pipe(
        debounceTime(CHECK_DEBOUNCE_MS),
        distinctUntilChanged(),
        switchMap((username) =>
          !username || usernameIssue(username) || username === this.saved()
            ? of<Availability>('idle')
            : concat(of<Availability>('checking'), this.check(username)),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((availability) => {
        this.availability.set(availability);
        // The backend's answer, as the control's error: "Salva" waits for a free name.
        if (availability === 'taken' || availability === 'reserved') {
          this.control.setErrors({ ...this.control.errors, username: availability });
          this.control.markAsTouched();
        }
      });

    // A suggestion only for an empty field, and only once its name is known to be free; asked once
    // the Instagram field has stopped changing, like the check above.
    const candidate = computed(() => (this.value() ? null : usernameFromInstagram(this.instagram())));
    toObservable(candidate)
      .pipe(
        debounceTime(CHECK_DEBOUNCE_MS),
        distinctUntilChanged(),
        switchMap((name) =>
          !name || name === this.saved()
            ? of(null)
            : this.check(name).pipe(map((availability) => (availability === 'free' ? name : null))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((name) => this.suggestion.set(name && !this.control.value ? name : null));
  }

  /** Typed the way it's kept, as it's typed. */
  protected normalize(): void {
    const normalized = normalizeUsername(this.control.value);
    if (normalized !== this.control.value) this.control.setValue(normalized);
  }

  protected useSuggestion(username: string): void {
    this.control.setValue(username);
    this.control.markAsDirty();
    this.suggestion.set(null);
  }

  private check(username: string): Observable<Availability> {
    return this.users.isUsernameAvailable(username).pipe(
      map((answer): Availability => {
        if (answer.available) return 'free';
        return answer.reason === 'TAKEN' ? 'taken' : answer.reason === 'RESERVED' ? 'reserved' : 'unknown';
      }),
      catchError(() => of<Availability>('unknown')),
    );
  }
}
