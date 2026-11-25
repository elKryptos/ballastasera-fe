import { ContactVisibility } from '../models/user.model';
import { InviteFriendStatus, InvitePhrase, ReportReason, SocialRelation } from '../models/social.model';

/** How the social features read, and the limits the backend sets for them (social-plan.md §3). The
 * Records keep each list complete: a new value in the backend fails here first. */

/** The follow button, by the viewer's relation with the person. */
export const RELATION_LABELS: Record<SocialRelation, string> = {
  NONE: 'Segui',
  FOLLOWING: 'Segui già',
  FOLLOWED_BY: 'Ricambia',
  MUTUAL: 'Amici',
};

/** Where a private profile shows in a list: no link, no way to follow (both would answer 404). */
export const PRIVATE_PROFILE_LABEL = 'Profilo privato';

/** Asked before unfollowing someone private: they can't be followed again until they're public. */
export const UNFOLLOW_PRIVATE_TEXT =
  'È un profilo privato: non potrai seguirlo di nuovo finché non lo rende pubblico.';

/** "Chi vede il tuo WhatsApp", in the order the form shows them. */
export const WHATSAPP_VISIBILITY_LABELS: Record<ContactVisibility, string> = {
  EVERYONE: 'Tutti',
  MUTUALS: 'Amici',
  NOBODY: 'Nessuno',
};

export const WHATSAPP_VISIBILITY_TEXTS: Record<ContactVisibility, string> = {
  EVERYONE: 'Chiunque apra il tuo profilo può scriverti.',
  MUTUALS: 'Solo chi vi seguite a vicenda. Gli altri vedono un lucchetto.',
  NOBODY: 'Non lo vede nessuno: resta salvato solo per te.',
};

/** "Chi vede le serate a cui vai". With NOBODY they still count among those going. */
export const ATTENDANCE_VISIBILITY_LABELS: Record<ContactVisibility, string> = {
  EVERYONE: 'Tutti',
  MUTUALS: 'Amici',
  NOBODY: 'Solo tu',
};

export const ATTENDANCE_VISIBILITY_TEXTS: Record<ContactVisibility, string> = {
  EVERYONE: 'Compari nella lista «Chi ci va» e sul tuo profilo.',
  MUTUALS: 'Ti vedono solo gli amici. Per gli altri sei tra i partecipanti senza nome.',
  NOBODY: 'Partecipi in incognito: nessuno vede il tuo nome.',
};

export const VISIBILITY_ORDER: ContactVisibility[] = ['EVERYONE', 'MUTUALS', 'NOBODY'];

/** "Profilo pubblico" off, said the way the plan decided (phase 2): private isolates from everything. */
export const PRIVATE_PROFILE_TEXT =
  'Nessuno, nemmeno i tuoi amici, potrà vedere il tuo profilo e le tue serate. Non comparirai in "Chi ci va" ' +
  'e le tue serate non usciranno nel feed degli amici. Non potrai invitare né essere invitato a ballare. ' +
  'Nessuno potrà iniziare a seguirti; le persone che ti seguono restano.';

export const PUBLIC_PROFILE_TEXT = 'Chi ti trova in una serata o tra gli amici può aprire il tuo profilo.';

/** "Segnala": the reasons, in the order the dialog lists them. */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  FAKE_PROFILE: 'Profilo falso',
  HARASSMENT: 'Comportamento molesto',
  INAPPROPRIATE_PHOTO: 'Foto non adatte',
  OTHER: 'Altro',
};

export const REPORT_REASONS = Object.keys(REPORT_REASON_LABELS) as ReportReason[];
export const REPORT_NOTE_MAX = 500;

/** The invite's fixed phrases (no free text). */
export const INVITE_PHRASE_LABELS: Record<InvitePhrase, string> = {
  CI_VIENI: 'Ci vieni?',
  ANDIAMO_INSIEME: 'Andiamo insieme?',
  MI_ACCOMPAGNI: 'Mi accompagni?',
  TI_VA_DI_BALLARE: 'Ti va di ballare?',
};

export const INVITE_PHRASES = Object.keys(INVITE_PHRASE_LABELS) as InvitePhrase[];

/** A friend's row in the invite dialog, when they can't be invited. */
export const INVITE_STATUS_LABELS: Record<Exclude<InviteFriendStatus, 'INVITABLE'>, string> = {
  ALREADY_GOING: 'Ci va già',
  ALREADY_INVITED: 'Già invitato',
  PRIVATE: 'Profilo privato: non può essere invitato',
};

/** Invites a day (the last 24 hours), as the backend counts them. */
export const MAX_INVITES_A_DAY = 10;

/** A private profile can't invite: said wherever "Invita a ballare" shows. */
export const INVITE_PRIVATE_TEXT = 'Il tuo profilo è privato: rendilo pubblico per invitare i tuoi amici.';

/** Hidden nights ("Chi vede le serate: nessuno"): the invite tells the friend which night. */
export const INVITE_HIDDEN_NIGHTS_TEXT = 'Il tuo amico vedrà che ci vai.';

/** The next goal under "Traguardi": the first of these above the nights done. */
export const NIGHT_MILESTONES = [10, 25, 50, 100, 200];

/** "Ricevi email". */
export const EMAIL_NOTIFICATIONS_TEXT =
  'Ti scriviamo quando qualcuno inizia a seguirti, quando diventi amico di qualcuno o ricevi un invito.';

/** The profile's own limits (UserUpdateDto, PATCH /users/me/avatar). */
export const BIO_MAX = 150;
export const SCHOOL_NAME_MAX = 80;
export const AVATAR_MAX_MB = 5;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** @username (UsernameUtils in the backend): lower case letters, digits, "." and "_", 3 to 30, no
 * dot first, last or twice in a row. */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const RESERVED_USERNAMES = ['admin', 'ballastasera', 'staff', 'support', 'help', 'info'];

/** The site's address in links people share: ballastasera.it/@name. */
export const SITE_HOST = 'ballastasera.it';
