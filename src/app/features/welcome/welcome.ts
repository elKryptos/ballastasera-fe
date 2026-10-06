import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { EventPinIcon } from '../../shared/event-filters/pin-icons';

interface WelcomeFeature {
  icon: 'pins' | 'map' | 'bell';
  /** Ties each row back to one of the pin colors used in the hero above. */
  accent: 'rose' | 'violet' | 'mint';
  title: string;
  copy: string;
}

/**
 * Landed on after each of a user's first three logins (loginCount <= 3, see
 * Oauth2Callback.postLoginUrl); from the fourth on, login goes straight to
 * /menu.
 */
@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.html',
  styleUrl: './welcome.css',
  imports: [SidebarPushDirective, EventPinIcon],
})
export class Welcome {
  private readonly router = inject(Router);

  protected readonly features: WelcomeFeature[] = [
    {
      icon: 'pins',
      accent: 'rose',
      title: 'Tutti gli eventi, un posto solo',
      copy: 'Salsa, bachata, kizomba e social: raccogliamo gli eventi di ballo latino a Milano così non devi più cercarli sparsi tra mille pagine.',
    },
    {
      icon: 'map',
      accent: 'violet',
      title: 'Sulla mappa, in tempo reale',
      copy: 'Ogni serata è un pin sulla mappa interattiva: vedi subito cosa c’è vicino a te, dove si balla stasera e cosa sta per iniziare.',
    },
    {
      icon: 'bell',
      accent: 'mint',
      title: 'Segui, resta aggiornato',
      copy: 'Segui gli eventi che ti interessano e ricevi le novità: orari cambiati, nuove date, locali aggiunti — sempre aggiornato, senza sforzo.',
    },
  ];

  protected enter(): void {
    this.router.navigateByUrl('/menu');
  }
}
