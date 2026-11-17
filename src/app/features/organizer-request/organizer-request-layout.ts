import { Component, effect, inject } from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';

/** The page around every step of "Diventa organizzatore". Its tag carries the
 * --ev-* palette (styles.css) and the ground, which turns to paper by day. */
@Component({
  selector: 'app-organizer-request',
  imports: [RouterOutlet, SidebarPushDirective],
  host: { class: 'block min-h-dvh bg-ground text-(--ev-text)' },
  templateUrl: './organizer-request-layout.html',
})
export class OrganizerRequestLayout {
  constructor() {
    const auth = inject(AuthService);
    const router = inject(Router);
    const scroller = inject(ViewportScroller);
    // Approved while on one of these pages: they're for users only, which the
    // route only checks on the way in. Signing out goes elsewhere by itself.
    effect(() => {
      const user = auth.currentUser();
      if (user && user.role !== 'USER') router.navigateByUrl('/menu');
    });
    // Each step opens at its top. The router keeps the scroll it finds (no
    // scrollPositionRestoration), so "Rivendica la pagina" from halfway down a
    // night, or a step's CTA at the bottom of a long form, would land mid-form.
    // Subscribed while the first navigation into the wizard is still on: its
    // NavigationEnd comes after this layout is created.
    router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => scroller.scrollToPosition([0, 0]));
  }
}
