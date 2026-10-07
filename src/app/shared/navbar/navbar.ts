import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { HlmSidebarImports, HlmSidebarService } from '@spartan-ng/helm/sidebar';
import { AuthModal } from '../auth-modal/auth-modal';
import { AuthService } from '../../core/services/auth.service';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { FEATURE_FLAGS } from '../../core/config/feature-flags';
import { AVAILABLE_LANGS } from '../../core/config/i18n';
import { writeLangCookie } from '../../core/i18n/lang-cookie';
import { UserRole } from '../../core/models/user.model';
import { ThemeService } from '../../core/services/theme.service';
import { RailTooltip } from '../directives/rail-tooltip.directive';
import { RoleDirective } from '../directives/role.directive';

/**
 * Site navigation: a Spartan sidebar (icon rail on desktop, expandable; an
 * off-canvas sheet on mobile) holding the same menu either way, plus a small
 * always-visible mobile top bar, since the sidebar itself renders nothing on
 * screen until its sheet is opened. Owns the auth dialog itself. Mounted
 * once, by NavLayout, for every page that has the navigation.
 */
@Component({
  selector: 'app-navbar',
  imports: [HlmSidebarImports, NgTemplateOutlet, AuthModal, RouterLink, RoleDirective, RailTooltip],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private readonly auth = inject(AuthService);
  private readonly featureFlags = inject(FeatureFlagService);
  private readonly sidebarService = inject(HlmSidebarService);
  private readonly themeService = inject(ThemeService);

  protected readonly authOpen = signal(false);

  // The desktop rail adds its own collapse/expand trigger to the menu;
  // mobile has one in the top bar instead.
  protected readonly isMobile = this.sidebarService.isMobile;

  // Drives the mobile trigger's accessible name (see navbar.html) so screen
  // readers hear "chiudi" rather than always "apri", once the drawer is open.
  protected readonly openMobile = this.sidebarService.openMobile;

  protected readonly currentUser = this.auth.currentUser;
  protected readonly isAuthenticated = this.auth.isAuthenticated;
  protected readonly mapEnabled = computed(() => this.featureFlags.isEnabled(FEATURE_FLAGS.mapPage));
  protected readonly learnEnabled = computed(() =>
    this.featureFlags.isEnabled(FEATURE_FLAGS.learnToDancePage),
  );

  protected readonly initial = computed(() => this.currentUser()?.displayName.trim().charAt(0).toUpperCase() ?? '');

  protected readonly theme = this.themeService.theme;
  /** The theme row names the theme you're in. The switch itself stays "Tema
   * scuro", on or off, for screen readers. */
  protected readonly themeLabel = computed(() => (this.theme() === 'dark' ? 'Tema scuro' : 'Tema chiaro'));

  private readonly transloco = inject(TranslocoService);

  protected readonly langs = AVAILABLE_LANGS;
  protected readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });
  protected readonly managerRoles: UserRole[] = ['ORGANIZER', 'ADMIN'];

  // No per-user totals endpoint yet — while these stay null the drawer hides
  // the Parteciperò badge and shows the email in place of the stats line.
  protected readonly goingCount = signal<number | null>(null);
  protected readonly likesCount = signal<number | null>(null);

  protected toggleTheme(): void {
    this.themeService.toggle();
  }

  protected setLang(lang: string): void {
    this.transloco.setActiveLang(lang);
    writeLangCookie(lang);
  }

  /** The menu's rows aren't hlmSidebarMenuButtons, so the sidebar's own
   * close-on-click doesn't cover them — links and actions call this. A no-op
   * on desktop, where the rail stays as it is after navigating. */
  protected closeDrawer(): void {
    this.sidebarService.setOpenMobile(false);
  }

  /** On the collapsed rail, a tap on anything that isn't a link or a button
   * itself (a row still waiting for its page, the language row, the avatar)
   * opens the rail to show that row in full. The theme row is a button: it
   * flips the theme right there. */
  protected expandRail(event: MouseEvent): void {
    const railCollapsed = !this.isMobile() && this.sidebarService.state() === 'collapsed';
    if (!railCollapsed || (event.target as Element).closest('a, button')) return;
    this.sidebarService.setOpen(true);
  }

  protected openAuth(): void {
    this.authOpen.set(true);
  }

  protected logout(): void {
    this.auth.logout().subscribe();
  }
}
