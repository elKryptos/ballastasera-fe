import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { FeatureFlag } from '../../core/config/feature-flags';

/**
 * Structural directive to gate a chunk of template behind a flag, for a
 * component that's already shipped but shouldn't render for everyone yet.
 * `*appFeature="'flagName'"`
 */
@Directive({
  selector: '[appFeature]',
})
export class FeatureFlagDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly flags = inject(FeatureFlagService);

  readonly appFeature = input.required<FeatureFlag>();

  constructor() {
    effect(() => {
      this.viewContainer.clear();
      if (this.flags.isEnabled(this.appFeature())) {
        this.viewContainer.createEmbeddedView(this.templateRef);
      }
    });
  }
}
