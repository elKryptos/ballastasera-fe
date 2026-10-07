import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FEATURE_FLAGS } from '../../../core/config/feature-flags';
import { FeatureFlagService } from '../../../core/services/feature-flag.service';
import { Dance } from '../lesson';

/**
 * The end of a dance's chapter: the step just learned, taken out to a real
 * floor — the nights to dance it on, on the map or in the list (each while
 * its page is on). Both are open without signing in, like the lesson.
 */
@Component({
  selector: 'app-lesson-tonight',
  imports: [RouterLink],
  templateUrl: './lesson-tonight.html',
  styleUrl: './lesson-tonight.css',
})
export class LessonTonight {
  readonly dance = input.required<Dance>();

  private readonly flags = inject(FeatureFlagService);
  protected readonly mapOn = this.flags.isEnabled(FEATURE_FLAGS.mapPage);
  protected readonly listOn = this.flags.isEnabled(FEATURE_FLAGS.eventListPage);
}
