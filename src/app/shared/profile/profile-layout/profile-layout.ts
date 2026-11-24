import { Component } from '@angular/core';

/**
 * A profile page's two parts, someone's (/persona) and one's own (/il-tuo-profilo): who they are
 * ([profileSide]: the hero and what's done with them) and the sections (the content). Stacked on a
 * phone; from a 56rem-wide page (the @4xl of <main>'s container) who they are stays on the left,
 * sticky, and from 72rem the sections go two by two.
 */
@Component({
  selector: 'app-profile-layout',
  templateUrl: './profile-layout.html',
  styleUrl: './profile-layout.css',
})
export class ProfileLayout {}
