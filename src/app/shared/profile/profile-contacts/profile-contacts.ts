import { Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInstagram } from '@ng-icons/lucide';
import { WHATSAPP_PATH } from '../../../core/config/brand-icons';
import { instagramHandle, instagramUrl, waMeUrl } from '../../../core/utils/event-format';

/**
 * "Contatti": WhatsApp and Instagram as cards in each app's colour, opening the chat or the profile.
 * When WhatsApp isn't shown to the viewer, a locked card can say why (lockedText): friends see it.
 * Shared by someone's profile, one's own ("Come ti vedono") and the profile inside "Chi ci va".
 */
@Component({
  selector: 'app-profile-contacts',
  imports: [NgIcon],
  providers: [provideIcons({ lucideInstagram })],
  templateUrl: './profile-contacts.html',
  styleUrl: './profile-contacts.css',
})
export class ProfileContacts {
  readonly instagram = input<string | null>(null);
  readonly whatsapp = input<string | null>(null);
  readonly whatsappLabel = input('Scrivi su WhatsApp');
  readonly whatsappHint = input('Si apre la chat');
  /** Shown in place of WhatsApp when there's none to show: why, and how it unlocks. */
  readonly lockedText = input<string | null>(null);
  /** When there's nothing at all. */
  readonly emptyText = input.required<string>();

  protected readonly whatsappPath = WHATSAPP_PATH;
  protected readonly whatsappUrl = computed(() => waMeUrl(this.whatsapp()));
  protected readonly instagramLink = computed(() => {
    const handle = this.instagram();
    return handle ? { handle: instagramHandle(handle), url: instagramUrl(handle) } : null;
  });
}
