import { Component, input } from '@angular/core';
import { InCommonItem } from '../../../core/utils/profile-view';

/** "Avete in comune" (canvas 4c, social phase 3): one row per thing the viewer and the person share
 * (see inCommon), each with its own icon and colour. Nothing to show, nothing drawn: the page leaves
 * the section out. */
@Component({
  selector: 'app-in-common',
  templateUrl: './in-common.html',
  styleUrl: './in-common.css',
})
export class InCommon {
  readonly items = input.required<InCommonItem[]>();
}
