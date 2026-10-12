import { lucideFacebook, lucideGlobe, lucideInstagram, lucideMail, lucideYoutube } from '@ng-icons/lucide';
import { TIKTOK_PATH, WHATSAPP_PATH } from '../config/brand-icons';
import { VenueDetailDto } from '../models/venue.model';
import { instagramUrl, waMeUrl } from './event-format';

export type ContactKey = 'whatsapp' | 'instagram' | 'website' | 'email' | 'facebook' | 'tiktok' | 'youtube';

/** How each kind of contact shows, wherever one does: the venue's page (its
 * row of actions) and the event page's chips. The tile behind the icon takes
 * the brand's own colour where it has one, so each link reads at a glance.
 * Logos lucide lacks are drawn from svgPath. */
interface ContactKind {
  key: ContactKey;
  /** The kind's name, never the handle, the number or the domain: a venue's
   * and an organizer's then read alike, and nothing is spelled out twice. */
  label: string;
  /** The one exception: a venue's link of this kind is labelled with the
   * value itself. The email — on a computer an address is handier read, or
   * copied, than opened. */
  spelledOut?: boolean;
  tileClass: string;
  icon?: string;
  svgPath?: string;
  /** From a venue's field. Defaults to the value itself (the URL the admin
   * entered); Instagram holds just the handle. */
  href?: (value: string) => string;
  /** mailto: stays in this tab — a new one would just open blank. */
  sameTab?: boolean;
}

/** In display order: most direct first. */
const CONTACT_KINDS: ContactKind[] = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    tileClass: 'bg-[#25D366] text-white',
    svgPath: WHATSAPP_PATH,
    href: (phone) => waMeUrl(phone) ?? '',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    tileClass: 'instagram-gradient text-white',
    icon: 'lucideInstagram',
    href: instagramUrl,
  },
  { key: 'website', label: 'Sito web', tileClass: 'bg-(--ev-tag-bg) text-(--ev-tag-text)', icon: 'lucideGlobe' },
  {
    key: 'email',
    label: 'Email',
    spelledOut: true,
    tileClass: 'bg-(--ev-tag-bg) text-(--ev-tag-text)',
    icon: 'lucideMail',
    href: (email) => `mailto:${email}`,
    sameTab: true,
  },
  { key: 'facebook', label: 'Facebook', tileClass: 'bg-[#1877F2] text-white', icon: 'lucideFacebook' },
  { key: 'tiktok', label: 'TikTok', tileClass: 'bg-black text-white', svgPath: TIKTOK_PATH },
  { key: 'youtube', label: 'YouTube', tileClass: 'bg-[#FF0000] text-white', icon: 'lucideYoutube' },
];

/** A contact ready to show: its kind's looks, with the link. */
export type ContactLink = Omit<ContactKind, 'href'> & { href: string };

/** The lucide icons the kinds name: a page showing contacts registers them
 * (provideIcons), or their tiles come out empty. */
export const CONTACT_ICONS = { lucideFacebook, lucideGlobe, lucideInstagram, lucideMail, lucideYoutube };

/** A link of the given kind that isn't a venue's field — an event's own
 * WhatsApp URL, its organizer's website — so the link is given as it is. */
export function contactLink(key: ContactKey, href: string): ContactLink {
  return { ...CONTACT_KINDS.find((kind) => kind.key === key)!, href };
}

/** Only the contacts the venue has. */
export function venueContacts(venue: Pick<VenueDetailDto, ContactKey>): ContactLink[] {
  return CONTACT_KINDS.flatMap((kind) => {
    const value = venue[kind.key];
    if (!value) return [];
    return [{ ...kind, href: kind.href?.(value) ?? value, label: kind.spelledOut ? value : kind.label }];
  });
}

/** The same links, with WhatsApp's opening the chat on `text`: already
 * written, for the visitor to send as it is or change first (the link's
 * ?text=). Left as they are: a link that isn't a chat with a number
 * (wa.me/message/…, whose opening text is set on WhatsApp's side), one that
 * already carries a text of its own, and anything that isn't a URL. */
export function withWhatsappText(links: ContactLink[], text: string): ContactLink[] {
  if (!text) return links;
  return links.map((link) => (link.key === 'whatsapp' ? { ...link, href: whatsappWithText(link.href, text) } : link));
}

function whatsappWithText(href: string, text: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  const chat = /(^|\.)(wa\.me|whatsapp\.com)$/.test(url.hostname) && !url.pathname.startsWith('/message/');
  if (!chat || url.searchParams.has('text')) return href;
  // encodeURIComponent rather than searchParams.set, which writes a space as
  // "+": %20 is what WhatsApp's own examples use.
  url.search += `${url.search ? '&' : '?'}text=${encodeURIComponent(text)}`;
  return url.toString();
}

/** Whether two links lead to the same place, whatever their case or a
 * trailing slash: an event's own links are often its venue's, copied over
 * when it was created. */
export function sameContact(a: ContactLink, b: ContactLink): boolean {
  const bare = (href: string) => href.trim().toLowerCase().replace(/\/+$/, '');
  return bare(a.href) === bare(b.href);
}
