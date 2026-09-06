import { Component, inject, signal } from '@angular/core';
import { Navbar } from '../../../shared/navbar/navbar';
import { AdminService } from '../../../core/services/admin.service';
import { OrganizerDetailDto } from '../../../core/models/organizer.model';

@Component({
  selector: 'app-pending-organizers',
  imports: [Navbar],
  templateUrl: './pending-organizers.html',
  styleUrl: './pending-organizers.css',
})
export class PendingOrganizers {
  private readonly admin = inject(AdminService)

  protected readonly organizers = signal<OrganizerDetailDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly verifyingId = signal<string | null>(null);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.admin.getPendingOrganizer().subscribe({
      next: (page) => {
        this.organizers.set(page.content);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected verify(id: string): void {
    this.verifyingId.set(id);
    this.admin.verifyOrganizer(id).subscribe({
      next: () => {
        this.organizers.update((list) => list.filter((o) => o.id !== id));
        this.verifyingId.set(null);
      },
      error: () => this.verifyingId.set(null)
    })
  }
}
