import { ChangeDetectionStrategy, Component, forwardRef, input } from '@angular/core';
import { BrnDialog, provideBrnDialogDefaultOptions } from '@spartan-ng/brain/dialog';
import { BrnSheet } from '@spartan-ng/brain/sheet';
import type { ClassValue } from 'clsx';
import { HlmSheetOverlay } from './hlm-sheet-overlay';

@Component({
  selector: 'hlm-sheet',
  exportAs: 'hlmSheet',
  imports: [HlmSheetOverlay],
  providers: [
    {
      provide: BrnDialog,
      useExisting: forwardRef(() => BrnSheet),
    },
    {
      provide: BrnSheet,
      useExisting: forwardRef(() => HlmSheet),
    },
    provideBrnDialogDefaultOptions({
      // add custom options here
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-sheet-overlay [class]="overlayClass()" />
    <ng-content />
  `,
})
export class HlmSheet extends BrnSheet {
  /** Extra classes for the scrim behind the sheet — e.g. to keep it clear of
   * chrome that must stay outside its dim/blur (see app-navbar's mobile bar). */
  public readonly overlayClass = input<ClassValue>('');
}
