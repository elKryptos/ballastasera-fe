import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmSidebarImports, HlmSidebarService } from '@spartan-ng/helm/sidebar';
import { AuthMode, AuthModal } from '../auth-modal/auth-modal';
import { AuthService } from '../../core/services/auth.service';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { FEATURE_FLAGS } from '../../core/config/feature-flags';
import { RoleDirective } from '../directives/role.directive';

/**
 * Site navigation: a Spartan sidebar (icon rail on desktop, expandable; an
 * off-canvas sheet on mobile) plus a small always-visible mobile top bar,
 * since the sidebar itself renders nothing on screen until its sheet is
 * opened. Owns the auth dialog itself, so any page just drops in
 * `<app-navbar>`.
 */
@Component({
  selector: 'app-navbar',
  imports: [HlmSidebarImports, AuthModal, RouterLink, RoleDirective],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private readonly auth = inject(AuthService);
  private readonly featureFlags = inject(FeatureFlagService);
  private readonly sidebarService = inject(HlmSidebarService);

  protected readonly authOpen = signal(false);
  protected readonly authMode = signal<AuthMode>('login');

  protected readonly currentUser = this.auth.currentUser;
  protected readonly isAuthenticated = this.auth.isAuthenticated;
  protected readonly mapEnabled = computed(() => this.featureFlags.isEnabled(FEATURE_FLAGS.mapPage));

  protected readonly initial = computed(() => this.currentUser()?.displayName.trim().charAt(0).toUpperCase() ?? '');

  protected openAuth(mode: AuthMode): void {
    this.authMode.set(mode);
    this.authOpen.set(true);
  }

  protected logout(): void {
    this.auth.logout().subscribe();
  }

  /** Opens/closes the mobile drawer from the top bar's account avatar. */
  protected toggleSidebar(): void {
    this.sidebarService.toggleSidebar();
  }
}
