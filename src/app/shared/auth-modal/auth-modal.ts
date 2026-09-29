import {
  Component,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { FEATURE_FLAGS } from '../../core/config/feature-flags';

type Step = 'form' | 'done';

/** The Apple button's replies, one per tap, the last one repeating. The joke
 * is on Apple, never on the visitor — plenty of them are on an iPhone. */
const APPLE_REPLIES = [
  "In arrivo… mai 🙃 Apple vuole 99 $ all'anno solo per farti entrare. Noi quei soldi li spendiamo in mojito.",
  'Insisti? La mela resta fuori dalla pista 🍏🚫',
  'Il buttafuori è stato chiaro: niente mele. Con Google entri subito 😉',
];

/**
 * Sign-in dialog. Google is the only way in — no email/password accounts:
 * everyone already has a Google account and there's no password to manage.
 * "Continua con Apple" is an easter egg, not a login: see tapApple().
 * With the googleAuth flag off (no backend on this environment) the Google
 * button lands on an honest "coming soon" state instead of faking a session.
 */
@Component({
  selector: 'app-auth-modal',
  templateUrl: './auth-modal.html',
  styleUrl: './auth-modal.css',
})
export class AuthModal {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly auth = inject(AuthService);
  private readonly featureFlags = inject(FeatureFlagService);

  /** Two-way: the opener (the navbar's "Accedi" button, a like/Parteciperò tap) toggles this. */
  readonly open = model(false);

  protected readonly step = signal<Step>('form');

  /** Taps on the Apple button since the dialog opened — see tapApple(). */
  protected readonly appleTaps = signal(0);
  protected readonly appleReply = computed(() => {
    const taps = this.appleTaps();
    return taps === 0 ? '' : APPLE_REPLIES[Math.min(taps, APPLE_REPLIES.length) - 1];
  });

  private readonly googleButton = viewChild<ElementRef<HTMLButtonElement>>('googleButton');
  private readonly appleButton = viewChild<ElementRef<HTMLButtonElement>>('appleButton');

  constructor() {
    // Body-scroll lock and initial focus are DOM-only, hence the platform
    // check — this component also renders on the server during SSR.
    effect(() => {
      const isOpen = this.open();
      if (!isPlatformBrowser(this.platformId)) return;

      if (isOpen) {
        this.step.set('form');
        this.appleTaps.set(0);
        document.body.style.overflow = 'hidden';
        // Only on a precise pointer (mouse/trackpad), where a focus ring on
        // the dialog's first action helps keyboard users; on a touchscreen it
        // would just flash a ring nobody asked for.
        if (window.matchMedia('(pointer: fine)').matches) {
          queueMicrotask(() => this.googleButton()?.nativeElement.focus());
        }
      } else {
        document.body.style.overflow = '';
      }
    });
  }

  protected close(): void {
    this.open.set(false);
  }

  /** Easter egg: no Sign in with Apple — Apple charges 99 $/year just to let
  people in. Each tap escalates the reply and shakes the button like a door
  that won't open (a "no" head-shake), unless the visitor asked for reduced
  motion. Web Animations rather than a CSS class, so every tap restarts it. */
  protected tapApple(): void {
    this.appleTaps.update((taps) => taps + 1);

    const button = this.appleButton()?.nativeElement;
    if (!button || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    button.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-7px)' },
        { transform: 'translateX(6px)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(3px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 420, easing: 'ease-in-out' },
    );
  }

  protected continueWithGoogle(): void {
    if (!this.featureFlags.isEnabled(FEATURE_FLAGS.googleAuth)) {
      // Backend not live yet on this environment — honest waiting-list signal.
      this.step.set('done');
      return;
    }

    // Full-page redirect to the backend's OAuth2 flow — it lands back on
    // /oauth2/callback with our JWT once Google confirms the login.
    this.auth.loginWithGoogle();
  }
}
