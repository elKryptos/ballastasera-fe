import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Navbar } from '../../shared/navbar/navbar';

interface WelcomeFeature {
  icon: 'pins' | 'map' | 'bell';
  /** Ties each row back to one of the pin colors used in the hero above. */
  accent: 'rose' | 'violet' | 'mint';
  title: string;
  copy: string;
}

/**
 * Landed on right after a user's first login (see Oauth2Callback.postLoginUrl).
 * Until the backend adds `hasSeenWelcome` to UserDto, every login counts as
 * "first" and lands here — see the TODO in enter() for what closes that loop.
 */
@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.html',
  styleUrl: './welcome.css',
  imports: [Navbar],
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
    // TODO: once the backend exposes `hasSeenWelcome` (see UserDto) and a
    // way to set it (e.g. PATCH /rest/auth/me), call that here before
    // navigating away — that's what stops this page from reappearing on
    // every subsequent login, not just the redirect logic in Oauth2Callback.
    this.router.navigateByUrl('/menu');
  }
}
