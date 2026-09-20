import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { OrganizerSummaryDto } from '../../../core/models/organizer.model';
import { Navbar } from '../../../shared/navbar/navbar';
import { BrnAlertDialogContent } from '@spartan-ng/brain/alert-dialog';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { SidebarPushDirective } from '../../../shared/directives/sidebar-push.directive';

@Component({
  selector: 'app-verified-organizer-list',
  imports: [Navbar, HlmAlertDialogImports, BrnAlertDialogContent, HlmButton, SidebarPushDirective],
  templateUrl: './verified-organizer-list.html',
  styleUrl: './verified-organizer-list.css',
})
export class VerifiedOrganizerList {
  private readonly admin = inject(AdminService);
  private readonly router = inject(Router);

  protected readonly organizers = signal<OrganizerSummaryDto[]>([]);
  protected readonly loading = signal<boolean>(true);
  protected readonly page = signal<number>(0);
  protected readonly totalPages = signal<number>(0);
  protected readonly deletingId = signal<string | null>(null);
  
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

  protected updateOrganizer(org: OrganizerSummaryDto): void {
    this.router.navigate(['/admin/update-organizer', org.id]);
  }

  protected deleteOrganizer(org: OrganizerSummaryDto): void {
    this.deletingId.set(org.id);
    this.admin.deleteOrganizer(org.id).subscribe({
      next: () => {
        this.organizers.update((organizers) => organizers.filter((o) => o.id !== org.id));
        this.deletingId.set(null);
      },
      error: (error) => {
        console.error('Error deleting organizer:', error);
        this.deletingId.set(null);
      }
    });
  }

  protected nextPage(): void {
    if (this.page() + 1 < this.totalPages()) return;
    this.page.update((p) => p + 1);
    this.load();
  }

  protected previousPage(): void {
    if (this.page() === 0) return;
    this.page.update((p) => p - 1);
    this.load();
  }
}
