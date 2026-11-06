import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AdminService } from '../../../core/services/admin.service';
import { OrganizerAdminDto } from '../../../core/models/organizer.model';
import { organizerOwnership } from '../../../core/config/organizer-types';
import { requestErrorMessage } from '../../../core/utils/organizer-request-errors';
import { BrnAlertDialogContent } from '@spartan-ng/brain/alert-dialog';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { SidebarPushDirective } from '../../../shared/directives/sidebar-push.directive';
import { instagramHandle, instagramUrl } from '../../../core/utils/event-format';

@Component({
  selector: 'app-verified-organizer-list',
  imports: [HlmAlertDialogImports, BrnAlertDialogContent, HlmButton, SidebarPushDirective],
  templateUrl: './verified-organizer-list.html',
  styleUrl: './verified-organizer-list.css',
})
export class VerifiedOrganizerList {
  private readonly admin = inject(AdminService);
  private readonly router = inject(Router);

  protected readonly organizers = signal<OrganizerAdminDto[]>([]);
  protected readonly loading = signal<boolean>(true);
  protected readonly page = signal<number>(0);
  protected readonly totalPages = signal<number>(0);
  /** The row with an action on its way: one at a time, and its dialogs stay disabled meanwhile. */
  protected readonly busyId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  /** Each organizer with who owns it, which decides its label and which buttons it gets. */
  protected readonly rows = computed(() =>
    this.organizers().map((organizer) => ({ organizer, ownership: organizerOwnership(organizer) })),
  );
  /** Older organizers may hold a profile URL instead of the handle. */
  protected readonly instagramUrl = instagramUrl;
  protected readonly instagramHandle = instagramHandle;

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.admin.getVerifiedOrganizers(this.page()).subscribe({
      next: (response) => {
        this.organizers.set(response.content);
        this.totalPages.set(response.page.totalPages);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error fetching verified organizers:', error);
        this.loading.set(false);
      }
    })
  }

  protected updateOrganizer(org: OrganizerAdminDto): void {
    this.router.navigate(['/admin/update-organizer', org.id]);
  }

  protected deleteOrganizer(org: OrganizerAdminDto): void {
    this.runOnRow(org, this.admin.deleteOrganizer(org.id), () =>
      this.organizers.update((organizers) => organizers.filter((o) => o.id !== org.id)),
    );
  }

  /** The page, its venue and its events stay: reloading shows it as the backend left it, without an owner. */
  protected unclaimOrganizer(org: OrganizerAdminDto): void {
    this.runOnRow(org, this.admin.unclaimOrganizer(org.id), () => this.load());
  }

  protected nextPage(): void {
    if (this.page() + 1 >= this.totalPages()) return;
    this.page.update((p) => p + 1);
    this.load();
  }

  protected previousPage(): void {
    if (this.page() === 0) return;
    this.page.update((p) => p - 1);
    this.load();
  }

  /** What every row action shares: one at a time, and the backend's error in the admin's words. */
  private runOnRow(org: OrganizerAdminDto, action: Observable<unknown>, onDone: () => void): void {
    if (this.busyId()) return;
    this.busyId.set(org.id);
    this.errorMessage.set(null);
    action.subscribe({
      next: () => {
        this.busyId.set(null);
        onDone();
      },
      error: (error) => {
        this.busyId.set(null);
        this.errorMessage.set(`${org.name}: ${requestErrorMessage(error)}`);
      },
    });
  }
}
