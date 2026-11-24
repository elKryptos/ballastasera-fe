import { Component, input } from '@angular/core';

/** "Scuola o crew" on a profile: the school's name with its icon, as a card. */
@Component({
  selector: 'app-profile-school',
  templateUrl: './profile-school.html',
  styleUrl: './profile-school.css',
})
export class ProfileSchool {
  readonly name = input.required<string>();
}
