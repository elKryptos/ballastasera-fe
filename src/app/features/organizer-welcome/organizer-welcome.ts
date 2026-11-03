import { Component, DestroyRef, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck } from '@ng-icons/lucide';
import { catchError, map, of } from 'rxjs';
import { OrganizerRequestDto } from '../../core/models/organizer-request.model';
import { OrganizerRequestsService } from '../../core/services/organizer-requests.service';
import { OrganizersService } from '../../core/services/organizers.service';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { OrganizerAvatar } from '../../shared/organizer-avatar/organizer-avatar';

function owesWelcome(request: OrganizerRequestDto | null): boolean {
  return request?.status === 'APPROVED' && !request.acknowledgedAt;
}

/** The page is for the moment of being approved: it's seen once. */
export const organizerWelcomeGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(OrganizerRequestsService).ensureLoaded().pipe(
    catchError(() => of(null)),
    map((request) => owesWelcome(request) || router.createUrlTree(['/menu'])),
  );
};

/** One of the first steps. What's "soon" has no page yet. */
interface FirstStep {
  title: string;
  text?: string;
  done?: boolean;
}

/**
 * "Sei un organizzatore!", shown once on being approved: watchOrganizerRequest
 * brings the user here. Leaving by any way counts as having seen it.
 */
@Component({
  selector: 'app-organizer-welcome',
  imports: [RouterLink, NgIcon, SidebarPushDirective, OrganizerAvatar],
  providers: [provideIcons({ lucideCheck })],
  host: { class: 'block min-h-dvh bg-ground text-(--ev-text)' },
  templateUrl: './organizer-welcome.html',
})
export class OrganizerWelcome {
  private readonly requests = inject(OrganizerRequestsService);
  private readonly organizers = inject(OrganizersService);

  protected readonly request = this.requests.myRequest;

  /** Its logo and its venue. The page reads fine without them if they don't load. */
  private readonly page = toSignal(this.loadPage(), { initialValue: null });

  protected readonly name = computed(() => this.request()?.organizerName ?? '');
  protected readonly logoUrl = computed(() => this.page()?.detail.logoUrl ?? this.request()?.logoUrl ?? null);
  private readonly venue = computed(() => this.page()?.venues[0] ?? null);

  protected readonly lead = computed(() => {
    const venue = this.venue();
    const yours = venue ? `${this.name()} è tua ed è collegata al locale di ${venue.address}.` : `${this.name()} è tua.`;
    const where = venue ? `sulla mappa e nella lista di ${venue.cityName}` : 'sulla mappa e nella lista';
    return `${yours} Le serate che pubblichi compaiono ${where}.`;
  });

  protected readonly steps = computed<FirstStep[]>(() => {
    const page = this.page();
    const venue = this.venue();
    return [
      { title: venue ? 'Profilo e locale collegati' : 'Profilo pronto', done: true },
      { title: 'Pubblica la prima serata', text: venue ? 'Data, stili e flyer: il luogo è già il tuo locale' : 'Data, luogo, stili e flyer' },
      { title: 'Crea una serata ricorrente', text: 'Per corsi e social di ogni settimana' },
      // Only once it's known there's no logo: it doesn't flash at someone who has one.
      ...(page && !this.logoUrl() ? [{ title: 'Completa il profilo', text: 'Manca ancora il logo' }] : []),
    ];
  });

  constructor() {
    const request = this.request();
    inject(DestroyRef).onDestroy(() => {
      // Not worth bothering anyone over: at worst it's shown once more.
      if (request) this.requests.acknowledge(request.id).pipe(catchError(() => of(null))).subscribe();
    });
  }

  private loadPage() {
    const request = this.requests.myRequest();
    if (!request?.organizerId || !request.organizerSlug) return of(null);
    return this.organizers
      .getWithVenues({ id: request.organizerId, slug: request.organizerSlug })
      .pipe(catchError(() => of(null)));
  }
}
