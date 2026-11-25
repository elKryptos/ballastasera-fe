import { Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { personPath } from '../../core/utils/person-links';
import { PersonAvatar } from '../person-avatar/person-avatar';

/** Who a row is about: a UserSummaryDto, or anything with the same few fields. */
export interface RowPerson {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  /** false: a private profile, shown without a link (its page would answer 404). */
  profilePublic?: boolean;
}

/**
 * One person in a list (Amici, Seguaci, Seguiti, Scopri, the bell, the invite dialog, the blocks):
 * their face, name and a line about them, the whole left part a link to their page; what's done
 * with them (a follow button, "Sblocca", "Invita") goes in the content, on the right. Rows sit in a
 * .person-list (styles.css), which draws the card and the lines between them.
 */
@Component({
  selector: 'app-person-row',
  imports: [NgTemplateOutlet, RouterLink, PersonAvatar],
  templateUrl: './person-row.html',
  styleUrl: './person-row.css',
})
export class PersonRow {
  readonly person = input.required<RowPerson>();
  /** The line under the name: why they're here, or what they're up to. */
  readonly subtitle = input<string | null>(null);
  /** The subtitle in mint: something happening now ("Stasera a Serata salsa"). */
  readonly highlight = input(false);
  /** A mint dot on the face: out tonight, or looking for someone to dance with. */
  readonly dot = input(false);
  /** Turns the link off even for a public profile (the row is already on their page). */
  readonly linked = input(true);

  protected readonly link = computed(() =>
    this.linked() && this.person().profilePublic !== false ? personPath(this.person().userId) : null,
  );
}
