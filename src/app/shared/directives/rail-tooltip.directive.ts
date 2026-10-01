import { Directive, effect, inject } from '@angular/core';
import { BrnTooltip, BrnTooltipPosition, provideBrnTooltipDefaultOptions } from '@spartan-ng/brain/tooltip';
import { HlmSidebarService } from '@spartan-ng/helm/sidebar';
import {
  DEFAULT_TOOLTIP_CONTENT_CLASSES,
  DEFAULT_TOOLTIP_SVG_CLASS,
  tooltipPositionVariants,
} from '@spartan-ng/helm/tooltip';
import { hlm } from '@spartan-ng/helm/utils';

/**
 * Names a sidebar menu row while the desktop rail is folded down to its
 * icons — off everywhere else (rail open, mobile drawer), where the row's own
 * label already says it. Same setup as the tooltip on Spartan's
 * hlmSidebarMenuButton, for rows that aren't one (links, plain rows, the
 * profile card).
 */
@Directive({
  selector: '[appRailTooltip]',
  providers: [
    provideBrnTooltipDefaultOptions({
      showDelay: 150,
      hideDelay: 0,
      tooltipContentClasses: DEFAULT_TOOLTIP_CONTENT_CLASSES,
      svgClasses: DEFAULT_TOOLTIP_SVG_CLASS,
      arrowClasses: (position: BrnTooltipPosition) => hlm(tooltipPositionVariants({ position })),
      position: 'right',
    }),
  ],
  hostDirectives: [{ directive: BrnTooltip, inputs: ['brnTooltip: appRailTooltip'] }],
})
export class RailTooltip {
  constructor() {
    const sidebar = inject(HlmSidebarService);
    const tooltip = inject(BrnTooltip);
    effect(() => tooltip.mutableTooltipDisabled.set(sidebar.isMobile() || sidebar.state() !== 'collapsed'));
  }
}
