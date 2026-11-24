import { Component, input } from '@angular/core';

let nextId = 0;

/** One section of a profile page ("Cosa balla", "Traguardi"…): its small uppercase title, which
 * names the section for screen readers, an optional link beside it ([sectionAction]: "Modifica",
 * "Le vedono tutti") and the content under it. */
@Component({
  selector: 'app-profile-section',
  templateUrl: './profile-section.html',
  styleUrl: './profile-section.css',
  host: { role: 'region', '[attr.aria-labelledby]': 'titleId' },
})
export class ProfileSection {
  readonly heading = input.required<string>();
  protected readonly titleId = `profile-section-${++nextId}`;
}
