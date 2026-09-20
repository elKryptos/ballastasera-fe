import { afterNextRender, Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('ballastasera-fe');

  private readonly transloco = inject(TranslocoService);

  constructor() {
    // Runs once, browser-only, right after the first render/hydration has
    // settled — doing this any earlier (e.g. in an APP_INITIALIZER) races
    // with SSR hydration, since the server always renders the default lang
    // (no localStorage there) and switching language too early corrupts it.
    afterNextRender(() => {
      const savedLang = localStorage.getItem('lang');
      if (savedLang) {
        this.transloco.setActiveLang(savedLang);
      }
    });
  }
}
