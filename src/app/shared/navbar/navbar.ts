import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthMode, AuthModal } from '../auth-modal/auth-modal';
import { AuthService } from '../../core/services/auth.service';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { FEATURE_FLAGS } from '../../core/config/feature-flags';
import { RoleDirective } from '../directives/role.directive';

/**
 * Site header: brand mark + name, an optional projected badge (e.g. the
 * "Work in progress" pill on the landing page), and the account entry point.
 * Owns the auth dialog itself, so any page just drops in `<app-navbar>`.
 */
@Component({
  selector: 'app-navbar',
  imports: [AuthModal, RouterLink, RoleDirective],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private readonly auth = inject(AuthService);
  private readonly featureFlags = inject(FeatureFlagService);

  protected readonly authOpen = signal(false);
  protected readonly authMode = signal<AuthMode>('login');
  protected readonly menuOpen = signal(false);

  protected readonly currentUser = this.auth.currentUser;
  protected readonly isAuthenticated = this.auth.isAuthenticated;
  protected readonly mapEnabled = computed(() => this.featureFlags.isEnabled(FEATURE_FLAGS.mapPage));

  protected readonly initial = computed(() => this.currentUser()?.displayName.trim().charAt(0).toUpperCase() ?? '');

  private readonly avatarButton = viewChild<ElementRef<HTMLButtonElement>>('avatarButton');
  // Whichever menu item renders first — the map link when the flag is on,
  // otherwise logout — gets initial focus.
  private readonly mapMenuItem = viewChild<ElementRef<HTMLElement>>('mapMenuItem');
  private readonly logoutMenuItem = viewChild<ElementRef<HTMLElement>>('logoutMenuItem');

  constructor() {
    // Moves focus into the menu when it opens (keyboard/screen-reader users
    // land straight on the first action) and back to the trigger when it
    // closes again — but never on first render, or the avatar button would
    // steal focus on page load.
    let wasOpen = false;
    effect(() => {
      const isOpen = this.menuOpen();
      if (isOpen) {
        queueMicrotask(() =>
          (this.mapMenuItem() ?? this.logoutMenuItem())?.nativeElement.focus(),
        );
      } else if (wasOpen) {
        this.avatarButton()?.nativeElement.focus({ preventScroll: true });
      }
      wasOpen = isOpen;
    });
  }

  protected openAuth(mode: AuthMode): void {
    this.authMode.set(mode);
    this.authOpen.set(true);
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected logout(): void {
    this.menuOpen.set(false);
    this.auth.logout().subscribe();
  }
}
