import { DestroyRef, Directive, ElementRef, PLATFORM_ID, inject, output } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** How far below the screen the sentinel starts the next page: it's on its
 * way before the reader gets to the end. */
const ROOT_MARGIN = '600px';

/**
 * Put on an empty element after a list: (appInfiniteScroll) fires once it
 * nears the screen. Only fires on coming into view, so render it with @if
 * only while there's a next page and none is loading — a new element after
 * each page fires again if the list still doesn't fill the screen.
 */
@Directive({ selector: '[appInfiniteScroll]' })
export class InfiniteScrollDirective {
  readonly appInfiniteScroll = output<void>();

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;

    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) this.appInfiniteScroll.emit();
      },
      { rootMargin: ROOT_MARGIN },
    );
    observer.observe(element);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }
}
