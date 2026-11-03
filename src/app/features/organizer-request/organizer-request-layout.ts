import { Component, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';

/** The page around every step of "Diventa organizzatore". Its tag carries the
 * --ev-* palette (styles.css) and the ground, which turns to paper by day. */
@Component({
  selector: 'app-organizer-request',
  imports: [RouterOutlet, SidebarPushDirective],
  host: { class: 'block min-h-dvh bg-ground text-(--ev-text)' },
  template: `
    <main appSidebarPush class="pt-(--header-h) md:pt-0">
      <router-outlet />
    </main>
  `,
})
export class OrganizerRequestLayout {
  constructor() {
    const auth = inject(AuthService);
    const router = inject(Router);
    // Approved while on one of these pages: they're for users only, which the
    // route only checks on the way in. Signing out goes elsewhere by itself.
    effect(() => {
      const user = auth.currentUser();
      if (user && user.role !== 'USER') router.navigateByUrl('/menu');
    });
  }
}
