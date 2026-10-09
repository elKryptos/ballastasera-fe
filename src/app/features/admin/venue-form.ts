import { ValidatorFn, Validators } from '@angular/forms';
import { VenueType } from '../../core/models/venue.model';
import { instagramHandle } from '../../core/utils/event-format';

/*
 * What CreateVenue and UpdateVenue share: the venue's own fields, their
 * validators and the "Contatti" section. The city and the organizer only
 * exist on create — the backend doesn't let an update change them.
 */

/** Quicker than the other forms' Photon search (300 ms). */
export const ADDRESS_SEARCH_DEBOUNCE_MS = 100;

// Contact patterns mirror the @URL/@Pattern on VenueCreateDto in the backend.
const WEBSITE_PATTERN = /^https?:\/\/\S+$/;
const WHATSAPP_PATTERN = /^\+?[0-9]{6,15}$/;
const FACEBOOK_PATTERN = /^https:\/\/(www\.|m\.)?facebook\.com\/.+/;
/** Instagram is stored as the bare handle, like organizers' and users'. */
const INSTAGRAM_HANDLE_PATTERN = /^[A-Za-z0-9._]{1,30}$/;
const YOUTUBE_PATTERN = /^https:\/\/(www\.)?youtube\.com\/.+/;
const TIKTOK_PATTERN = /^https:\/\/(www\.)?tiktok\.com\/@.+/;

/** Spaces, dots, dashes and brackets are fine to type; the backend only takes "+" and digits. */
export const stripPhone = (value: string): string => value.replace(/[\s().-]/g, '');

const whatsappValidator: ValidatorFn = (control) => {
  const phone = stripPhone(control.value ?? '');
  return !phone || WHATSAPP_PATTERN.test(phone) ? null : { whatsapp: true };
};

/** The handle, "@handle" or a pasted profile URL: what's checked (and saved) is the handle. */
const instagramValidator: ValidatorFn = (control) => {
  const handle = instagramHandle(control.value ?? '');
  return !handle || INSTAGRAM_HANDLE_PATTERN.test(handle) ? null : { instagram: true };
};

/** Optional text fields: empty (or only spaces) goes to the backend as null. */
export const optional = (value: string): string | null => value.trim() || null;

/** The venue's own controls, for `fb.nonNullable.group({ ...venueControls() })`.
 * Limits mirror the @Size/@DecimalMin/@DecimalMax on VenueCreateDto in the backend. */
export const venueControls = () => ({
  name: ['', [Validators.required, Validators.maxLength(100)]],
  type: ['' as VenueType | '', [Validators.required]],
  address: ['', [Validators.required, Validators.maxLength(150)]],
  // Optional: left empty, the backend geocodes the address.
  latitude: [null as number | null, [Validators.min(-90), Validators.max(90)]],
  longitude: [null as number | null, [Validators.min(-180), Validators.max(180)]],
  description: ['', [Validators.maxLength(1000)]],
  // Contacts are all optional.
  website: ['', [Validators.pattern(WEBSITE_PATTERN), Validators.maxLength(100)]],
  whatsapp: ['', [whatsappValidator]],
  email: ['', [Validators.email, Validators.maxLength(100)]],
  facebook: ['', [Validators.pattern(FACEBOOK_PATTERN), Validators.maxLength(100)]],
  instagram: ['', [instagramValidator, Validators.maxLength(100)]],
  youtube: ['', [Validators.pattern(YOUTUBE_PATTERN), Validators.maxLength(100)]],
  tiktok: ['', [Validators.pattern(TIKTOK_PATTERN), Validators.maxLength(100)]],
});

type ContactControl = 'website' | 'whatsapp' | 'email' | 'instagram' | 'facebook' | 'youtube' | 'tiktok';

/** The "Contatti" section, in display order — one template block for all of them. */
export const CONTACT_FIELDS: {
  name: ContactControl;
  label: string;
  type: 'url' | 'tel' | 'email' | 'text';
  placeholder: string;
  error: string;
  /** Spans both columns from md up. */
  wide?: boolean;
}[] = [
  {
    name: 'website',
    label: 'Sito web',
    type: 'url',
    placeholder: 'https://...',
    error: 'URL non valido: deve iniziare con http:// o https:// (max 100 caratteri).',
    wide: true,
  },
  {
    name: 'whatsapp',
    label: 'WhatsApp',
    type: 'tel',
    placeholder: '+39 333 123 4567',
    error: 'Numero con prefisso internazionale (6-15 cifre).',
  },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'info@...', error: 'Email non valida (max 100 caratteri).' },
  {
    name: 'instagram',
    label: 'Instagram',
    type: 'text',
    placeholder: 'nome_account',
    error: 'Solo il nome dell\'account: lettere, numeri, punti e _ (max 30).',
  },
  {
    name: 'facebook',
    label: 'Facebook',
    type: 'url',
    placeholder: 'https://facebook.com/...',
    error: 'Deve essere un URL https://facebook.com/... (max 100 caratteri).',
  },
  {
    name: 'youtube',
    label: 'YouTube',
    type: 'url',
    placeholder: 'https://youtube.com/...',
    error: 'Deve essere un URL https://youtube.com/... (max 100 caratteri).',
  },
  {
    name: 'tiktok',
    label: 'TikTok',
    type: 'url',
    placeholder: 'https://tiktok.com/@...',
    error: 'Deve essere un URL https://tiktok.com/@... (max 100 caratteri).',
  },
];

export const VENUE_TYPES: { value: VenueType; label: string }[] = [
  { value: 'SCHOOL', label: 'Scuola' },
  { value: 'CLUB', label: 'Club' },
  { value: 'BAR', label: 'Bar' },
  { value: 'OTHER', label: 'Altro' },
];
