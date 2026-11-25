import { Component, input, output } from '@angular/core';

/** "Precedente · 2 / 5 · Successiva" under a list paged by number (the admin's lists). Drawn only with
 * more than one page; `page` counts from 0. */
@Component({
  selector: 'app-page-nav',
  templateUrl: './page-nav.html',
})
export class PageNav {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly pageChange = output<number>();
}
