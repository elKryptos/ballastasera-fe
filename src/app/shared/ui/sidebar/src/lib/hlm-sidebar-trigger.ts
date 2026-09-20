import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePanelLeft } from '@ng-icons/lucide';
import { HlmButton, provideBrnButtonConfig } from '@spartan-ng/helm/button';
import { HlmSidebarService } from './hlm-sidebar.service';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[hlmSidebarTrigger]',
  imports: [NgIcon],
  providers: [
    provideIcons({ lucidePanelLeft }),
    provideBrnButtonConfig({ variant: 'ghost', size: 'icon-sm' }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: HlmButton, inputs: ['variant', 'size'] }],
  host: {
    'data-slot': 'sidebar-trigger',
    'data-sidebar': 'trigger',
    '[attr.aria-expanded]': '_isOpen()',
    '(pointerdown)': '_captureOpenState()',
    '(keydown.enter)': '_captureOpenState()',
    '(keydown.space)': '_captureOpenState()',
    '(click)': '_onClick()',
  },
  template: `
    <ng-icon
      name="lucidePanelLeft"
      class="transition-transform duration-300 ease-out"
      [class.rotate-180]="_isOpen()"
    />
    <span class="sr-only">{{ srOnlyText() }}</span>
  `,
})
export class HlmSidebarTrigger {
  private readonly _sidebarService = inject(HlmSidebarService);

  public readonly srOnlyText = input<string>('Toggle Sidebar');

  // Drives the icon's rotation — same trigger, opening and closing states
  // just play the transition in opposite directions.
  protected readonly _isOpen = computed(() =>
    this._sidebarService.isMobile()
      ? this._sidebarService.openMobile()
      : this._sidebarService.state() === 'expanded',
  );

  // On mobile this button lives outside the sheet's own overlay pane (the
  // top bar stays visible above the drawer) — so a tap on it is *also*
  // picked up by Angular CDK's own outside-click dismissal, which runs in
  // the capture phase on `document.body` and therefore *always* fires
  // before this button's own (click) handler. When the sheet is open, by
  // the time _onClick() runs, CDK has already closed it and — crucially —
  // BrnDialogRef exposes a reopen() that un-cancels a dialog still mid
  // "closing" phase. So blindly opening here would immediately undo the
  // dismissal that just happened on this very click. Reading the service's
  // live signal inside _onClick() can't tell "was already closed" apart
  // from "CDK just closed it a moment ago", since both read false — so the
  // state has to be snapshotted *before* CDK gets a chance to touch it, on
  // the pointerdown/keydown that precedes the click.
  private _wasOpenBeforeInteraction = false;

  protected _captureOpenState(): void {
    this._wasOpenBeforeInteraction = this._sidebarService.openMobile();
  }

  protected _onClick(): void {
    if (this._sidebarService.isMobile()) {
      if (!this._wasOpenBeforeInteraction) {
        this._sidebarService.setOpenMobile(true);
      }
      // else: it was already open when this interaction started — CDK's
      // own dismissal already closed it on this same click, so leave it be.
    } else {
      this._sidebarService.toggleSidebar();
    }
  }
}
