import {
  Component,
  ElementRef,
  PLATFORM_ID,
  effect,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type AuthMode = 'login' | 'signup';
type Step = 'form' | 'done';

/**
 * Login / create-account dialog. There is no auth backend yet, so a
 * successful submit or Google click lands on an honest "done" state instead
 * of faking a session — see the TODOs below for where the real calls go.
 */
@Component({
  selector: 'app-auth-modal',
  imports: [FormsModule],
  templateUrl: './auth-modal.html',
  styleUrl: './auth-modal.css',
})
export class AuthModal {
  private readonly platformId = inject(PLATFORM_ID);

  /** Two-way: the opener (the navbar's "Accedi" button) toggles this. */
  readonly open = model(false);

  /** Which tab is shown first. The dialog itself still lets people switch. */
  readonly mode = input<AuthMode>('login');

  protected readonly tab = signal<AuthMode>('login');
  protected readonly step = signal<Step>('form');
  protected readonly showPassword = signal(false);

  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');

  protected readonly nameError = signal(false);
  protected readonly emailError = signal(false);
  protected readonly passwordError = signal(false);

  private readonly emailField = viewChild<ElementRef<HTMLInputElement>>('emailField');

  constructor() {
    // Body-scroll lock and initial focus are DOM-only, hence the platform
    // check — this component also renders on the server during SSR.
    effect(() => {
      const isOpen = this.open();
      if (!isPlatformBrowser(this.platformId)) return;

      if (isOpen) {
        this.tab.set(this.mode());
        this.step.set('form');
        this.resetErrors();
        document.body.style.overflow = 'hidden';
        queueMicrotask(() => this.emailField()?.nativeElement.focus());
      } else {
        document.body.style.overflow = '';
      }
    });
  }

  protected switchTab(tab: AuthMode): void {
    this.tab.set(tab);
    this.resetErrors();
  }

  protected close(): void {
    this.open.set(false);
  }

  private resetErrors(): void {
    this.nameError.set(false);
    this.emailError.set(false);
    this.passwordError.set(false);
  }

  protected continueWithGoogle(): void {
    // TODO: wire real Google OAuth (e.g. Google Identity Services) once the
    // backend can accept the token. For now this is an honest waiting-list
    // signal, not a fake sign-in.
    this.step.set('done');
  }

  protected submit(): void {
    const isSignup = this.tab() === 'signup';
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(this.email().trim());
    const passwordValid = this.password().length >= 8;
    const nameValid = !isSignup || this.name().trim().length > 1;

    this.emailError.set(!emailValid);
    this.passwordError.set(!passwordValid);
    this.nameError.set(!nameValid);

    if (!emailValid || !passwordValid || !nameValid) return;

    // TODO: POST to the auth endpoint once the backend exists.
    this.step.set('done');
  }
}
