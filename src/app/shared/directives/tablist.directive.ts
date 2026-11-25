import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Directive, ElementRef, PLATFORM_ID, afterNextRender, booleanAttribute, inject, input } from '@angular/core';

/**
 * The keyboard of the ARIA tabs pattern, for any role="tablist" whose tabs are buttons with
 * role="tab" and aria-selected: ← and → move between the tabs (round the ends), Home and End to the
 * first and the last. One tab stop for the whole group (a roving tabindex): Tab lands on the selected
 * tab, and leaves the group from there.
 *
 * By default the arrows only move the focus and Enter or Space selects, as most of the app's tabs
 * change the URL or load a list: arrowing past three of them shouldn't load three. With
 * [selectOnFocus] the tab focused is also selected, for tabs that only swap what's shown.
 *
 * The selected tab is the template's (aria-selected): watched, so the tab stop follows it however it
 * changes (a tap, the URL, Back).
 */
@Directive({
  selector: '[role=tablist]',
  host: { '(keydown)': 'onKeydown($event)' },
})
export class TablistDirective {
  private readonly host: HTMLElement = inject(ElementRef<HTMLElement>).nativeElement;

  /** The tab focused by an arrow is selected too (a click on it). */
  readonly selectOnFocus = input(false, { transform: booleanAttribute });

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const observer = new MutationObserver(() => this.syncTabStop());
    afterNextRender(() => {
      this.syncTabStop();
      // Tabs come and go with @for, and aria-selected and disabled change with the state. Not
      // tabindex, which is ours: setting it doesn't wake this up again.
      observer.observe(this.host, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['aria-selected', 'disabled'],
      });
    });
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }

  protected onKeydown(event: KeyboardEvent): void {
    const tabs = this.tabs();
    const current = tabs.indexOf(event.target as HTMLElement);
    if (current < 0 || event.altKey || event.ctrlKey || event.metaKey) return;
    const last = tabs.length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = current === last ? 0 : current + 1;
        break;
      case 'ArrowLeft':
        next = current === 0 ? last : current - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    const tab = tabs[next];
    // The tab stop moves with the focus: Tab and back returns here until the selection changes.
    for (const other of tabs) other.tabIndex = other === tab ? 0 : -1;
    tab.focus();
    if (this.selectOnFocus()) tab.click();
  }

  /** The tabs that can be reached: disabled ones are skipped. */
  private tabs(): HTMLElement[] {
    return [...this.host.querySelectorAll<HTMLElement>('[role="tab"]')].filter(
      (tab) => !(tab as HTMLButtonElement).disabled,
    );
  }

  /** The selected tab is the group's one stop (the first, if none is selected yet). */
  private syncTabStop(): void {
    const tabs = this.tabs();
    const selected = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') ?? tabs[0];
    for (const tab of tabs) tab.tabIndex = tab === selected ? 0 : -1;
  }
}
