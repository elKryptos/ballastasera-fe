import { Component } from '@angular/core';

/* The navbar's Vice City pieces (GTA VI's launch), added by navbar.html only
while SeasonService says it's on. Styles: season-vice.css, global like the
rest of the menu's. */

/** The logo's sunset: its gradient and the sun's stripes cut out of the
 * drop's lower half, in the logo's own 200×210 units. Once for the whole
 * navbar, outside the top bar and the rail (either can be hidden, and defs
 * in a hidden SVG don't paint): season-vice.css points the drop at them. */
@Component({
  selector: 'app-vice-defs',
  template: `
    <svg width="0" height="0">
      <linearGradient id="vice-sun" x1="0" y1="28" x2="0" y2="182" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="var(--vice-sun)" />
        <stop offset="0.38" stop-color="var(--vice-orange)" />
        <stop offset="0.7" stop-color="var(--vice-pink)" />
        <stop offset="1" stop-color="var(--vice-violet)" />
      </linearGradient>
      <mask id="vice-stripes" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="210">
        <rect width="200" height="210" fill="#fff" />
        <rect y="122" width="200" height="6" fill="#000" />
        <rect y="138" width="200" height="8" fill="#000" />
        <rect y="155" width="200" height="10" fill="#000" />
      </mask>
    </svg>
  `,
  host: { class: 'absolute size-0 overflow-hidden', 'aria-hidden': 'true' },
})
export class ViceDefs {}

/** A full wanted level after the wordmark, flashing. */
@Component({
  selector: 'app-vice-stars',
  template: `
    @for (star of stars; track star) {
      <svg viewBox="0 0 24 24">
        <path d="M12 2.5l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 16.8 6.2 20l1.4-6.4L2.7 9.2l6.5-.7z" />
      </svg>
    }
  `,
  host: { class: 'vice-stars', 'aria-hidden': 'true' },
})
export class ViceStars {
  protected readonly stars = [1, 2, 3, 4, 5];
}

/** The top bar's sunset glow under the logo and neon horizon along its foot,
 * behind its logo and buttons, like Halloween's bats. */
@Component({
  selector: 'app-vice-horizon',
  template: '',
  host: { class: 'vice-horizon', 'aria-hidden': 'true' },
})
export class ViceHorizon {}
