import { Directive, booleanAttribute, computed, inject, input } from '@angular/core';
import { HlmSidebarService } from '@spartan-ng/helm/sidebar';
import { classes } from '@spartan-ng/helm/utils';

/**
 * Desktop-only: pushes this element over via a `--content-inset` custom
 * property instead of letting the sidebar rail overlay it while expanded.
 *
 * Uses `classes()` (not a static template class) so the push transition is
 * suppressed on this element's first paint — routed components get a fresh
 * host element on every navigation, and without that suppression the
 * transition would replay the resize animation each time a page mounts
 * with the sidebar already expanded, even though nothing actually changed.
 */
@Directive({
  selector: '[appSidebarPush]',
  host: {
    '[style.--content-inset]': '_contentInset()',
  },
})
export class SidebarPushDirective {
  private readonly _sidebarService = inject(HlmSidebarService);

  /**
   * Lets a host opt out at runtime — e.g. landing's legacy navbar variant,
   * which renders no sidebar at all — without removing the directive from
   * the template.
   */
  public readonly appSidebarPush = input(true, { transform: booleanAttribute });

  protected readonly _contentInset = computed(() => {
    if (!this.appSidebarPush()) return null;
    return this._sidebarService.state() === 'expanded' ? 'var(--sidebar-width)' : 'var(--sidebar-width-icon)';
  });

  constructor() {
    classes(() =>
      this.appSidebarPush() ? 'transition-[padding-left] duration-200 ease-linear md:pl-(--content-inset)' : '',
    );
  }
}
