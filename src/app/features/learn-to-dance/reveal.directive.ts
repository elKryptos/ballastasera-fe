import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input, numberAttribute } from '@angular/core';

/**
 * The lesson's entrance: whatever starts below the fold rises in once it's
 * scrolled to, `appReveal` ms after the others in its row. Also tags the
 * element `.is-revealed` as it shows, for the pieces that play their own
 * animation then (the struck-out mistakes, the drawn flourishes).
 *
 * Runs on the element itself (Web Animations) rather than through a shared
 * stylesheet, so each section's component can use it without styling it.
 * Nothing is hidden before the browser takes over: the server's HTML shows
 * everything, and so does a reader who'd rather have no motion.
 */
@Directive({ selector: '[appReveal]' })
export class Reveal {
  /** Delay in ms, to stagger the cards of one row. */
  readonly appReveal = input(0, { transform: (v: unknown) => numberAttribute(v, 0) });

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') {
        el.classList.add('is-revealed');
        return;
      }
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let seen = false;
      let hidden = false;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!seen) {
            seen = true;
            // Already on screen: leave it be. Below the fold: hide it until
            // it's reached, out of sight either way.
            if (!entry.isIntersecting && !calm) {
              hidden = true;
              el.style.opacity = '0';
            }
          }
          if (!entry.isIntersecting) return;
          observer.disconnect();
          el.classList.add('is-revealed');
          if (!hidden) return;
          el.style.opacity = '';
          el.animate(
            [
              { opacity: 0, transform: 'translateY(2.5rem) scale(0.98)' },
              { opacity: 1, transform: 'none' },
            ],
            { duration: 800, delay: this.appReveal(), easing: 'cubic-bezier(.2,.75,.2,1)', fill: 'backwards' },
          );
        },
        { rootMargin: '0px 0px -10% 0px' },
      );

      observer.observe(el);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
