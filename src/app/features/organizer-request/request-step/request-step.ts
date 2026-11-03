import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideChevronLeft, lucideSend } from '@ng-icons/lucide';
import { OrganizerRequestFormStore, RequestStep, requestStepUrl } from '../organizer-request-form.store';

/** What every step has around its own content: the way back, the progress,
 * the heading and the button at the bottom. The count comes from the store,
 * since the steps depend on the draft (see needsLocale). */
@Component({
  selector: 'app-request-step',
  imports: [RouterLink, NgIcon],
  providers: [provideIcons({ lucideArrowRight, lucideChevronLeft, lucideSend })],
  host: { class: 'block' },
  templateUrl: './request-step.html',
})
export class RequestStepShell {
  private readonly store = inject(OrganizerRequestFormStore);

  readonly step = input.required<RequestStep>();
  readonly heading = input.required<string>();
  readonly lead = input<string>();
  readonly ctaLabel = input('Continua');
  readonly ctaIcon = input<'lucideArrowRight' | 'lucideSend'>('lucideArrowRight');
  readonly ctaDisabled = input(false);
  /** A way back that stays on this step's route, instead of going to the previous one. */
  readonly inPlaceBackLabel = input<string | null>(null);

  readonly ctaClicked = output<void>();
  readonly inPlaceBackClicked = output<void>();

  private readonly steps = this.store.steps;
  protected readonly stepNumber = computed(() => this.steps().indexOf(this.step()) + 1);
  protected readonly stepCount = computed(() => this.steps().length);
  protected readonly bars = computed(() => this.steps().map((_, index) => index < this.stepNumber()));

  /** The previous step, or the menu from the first one. */
  protected readonly back = computed(() => {
    const previous = this.store.previousStep(this.step());
    return previous ? { url: requestStepUrl(previous), label: 'Indietro' } : { url: '/menu', label: 'Menu' };
  });
}
