import { Component, computed, input } from '@angular/core';
import { initialOf } from '../../core/utils/initials';
import { personTone } from '../../core/utils/person-tone';

/**
 * Someone's face wherever people show: their photo, or their initial on their own colour
 * (personTone), the same colour in every list and in their profile. Round; its size is the
 * caller's (a size-* class on the element), the initial scales with it. Photos in lists load as
 * they scroll near (loading="lazy"); a profile's header passes eager.
 */
@Component({
  selector: 'app-person-avatar',
  templateUrl: './person-avatar.html',
  styleUrl: './person-avatar.css',
  host: { '[style.--tone-bg]': 'tone().bg', '[style.--tone-fg]': 'tone().fg' },
})
export class PersonAvatar {
  readonly userId = input.required<string>();
  readonly name = input.required<string>();
  readonly url = input<string | null | undefined>(null);
  readonly loading = input<'lazy' | 'eager'>('lazy');

  protected readonly initial = computed(() => initialOf(this.name()));
  protected readonly tone = computed(() => personTone(this.userId()));
}
