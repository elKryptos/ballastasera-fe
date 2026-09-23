import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { InstallPromptService } from '../../core/services/install-prompt.service';
import { dismissInstallBanner, isInstallBannerDismissed } from '../../core/config/pwa';

/**
 * Dismissible "install this as an app" banner. Android/Chrome gets a working
 * "Install" button (backed by the captured `beforeinstallprompt` event);
 * iOS/Safari has no such event at all, so it gets plain instructions for the
 * manual Share -> Add to Home Screen flow instead. Hidden once already
 * installed, or for two weeks after being closed.
 */
@Component({
  selector: 'app-install-banner',
  imports: [TranslocoPipe],
  templateUrl: './install-banner.html',
  styleUrl: './install-banner.css',
})
export class InstallBanner {
  protected readonly install = inject(InstallPromptService);
  private readonly dismissed = signal(true);

  protected readonly visible = computed(
    () =>
      !this.dismissed() &&
      !this.install.isStandalone() &&
      (this.install.canInstall() || this.install.isIos()),
  );

  constructor() {
    // Browser-only read of localStorage; starts `dismissed` true so there's
    // nothing to render before this settles, matching the service's own
    // signals (see InstallPromptService) which also default to "hidden"
    // until after hydration.
    afterNextRender(() => this.dismissed.set(isInstallBannerDismissed()));
  }

  protected close(): void {
    this.dismissed.set(true);
    dismissInstallBanner();
  }

  protected startInstall(): void {
    void this.install.promptInstall();
  }
}
