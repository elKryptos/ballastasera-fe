import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft } from '@ng-icons/lucide';
import { Subject, catchError, of, switchMap } from 'rxjs';
import { OrganizerRequestAdminDto, OrganizerRequestStatus } from '../../../core/models/organizer-request.model';
import { AdminService } from '../../../core/services/admin.service';
import { SidebarPushDirective } from '../../../shared/directives/sidebar-push.directive';
import { OrganizerRequestCard } from './organizer-request-card/organizer-request-card';

const TABS: { status: OrganizerRequestStatus; label: string }[] = [
  { status: 'PENDING', label: 'In attesa' },
  { status: 'APPROVED', label: 'Approvate' },
  { status: 'REJECTED', label: 'Rifiutate' },
];

/** The queue of "Diventa organizzatore" requests, by status. Each card decides
 * its own request; this page only lists them and reloads after a decision.
 * Comes back from create-venue with ?richiesta=<id>&locale=<venueId>: the venue
 * just created for that request, to link when approving it. */
@Component({
  selector: 'app-organizer-requests',
  imports: [RouterLink, NgIcon, SidebarPushDirective, OrganizerRequestCard],
  providers: [provideIcons({ lucideChevronLeft })],
  host: { class: 'block min-h-dvh bg-ground text-(--ev-text)' },
  templateUrl: './organizer-requests.html',
})
export class OrganizerRequestsPage {
  private readonly admin = inject(AdminService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tabs = TABS;
  protected readonly status = signal<OrganizerRequestStatus>('PENDING');
  protected readonly requests = signal<OrganizerRequestAdminDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly page = signal(0);
  protected readonly totalPages = signal(0);
  /** "In attesa · N": kept while another tab is open. */
  protected readonly pendingCount = signal<number | null>(null);
  protected readonly notice = signal<string | null>(null);

  private readonly createdFor = this.route.snapshot.queryParamMap.get('richiesta');
  private readonly createdVenueId = this.route.snapshot.queryParamMap.get('locale');

  /** switchMap: only the latest asked for shows, however fast the tabs change. */
  private readonly reload$ = new Subject<void>();

  constructor() {
    this.reload$
      .pipe(
        switchMap(() => this.admin.getOrganizerRequests(this.status(), this.page()).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        // The last request of the last page was just decided: that page is gone.
        if (result && result.content.length === 0 && this.page() > 0) {
          this.page.update((page) => page - 1);
          this.load();
          return;
        }
        this.loading.set(false);
        this.loadFailed.set(result === null);
        this.requests.set(result?.content ?? []);
        this.totalPages.set(result?.page.totalPages ?? 0);
        if (result && this.status() === 'PENDING') this.pendingCount.set(result.page.totalElements);
      });
    this.load();
  }

  protected selectTab(status: OrganizerRequestStatus): void {
    if (status === this.status()) return;
    this.status.set(status);
    this.page.set(0);
    this.notice.set(null);
    this.requests.set([]);
    this.load();
  }

  protected goToPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected createdVenueFor(request: OrganizerRequestAdminDto): string | null {
    return request.id === this.createdFor ? this.createdVenueId : null;
  }

  protected onReviewed(message: string): void {
    this.notice.set(message);
    this.load();
  }

  protected onAlreadyReviewed(): void {
    this.notice.set('Già revisionata: la lista è stata aggiornata.');
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.reload$.next();
  }
}
