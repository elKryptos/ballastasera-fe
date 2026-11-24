import { INVITE_PRIVATE_TEXT } from '../config/social';
import { InviteFriendStatus } from '../models/social.model';
import { apiErrorCode, apiErrorMessage } from './api-errors';

/** The invites' own limit (10 a day), apart from the general rate limit. */
export const INVITE_LIMIT = 'INVITE_LIMIT';

export const NO_INVITES_LEFT_TEXT = 'Hai finito gli inviti per oggi. Domani ne hai altri.';

/** What a refused invite means for the friend's row: the status it should show now, when it says one. */
export function inviteStatusFromError(error: unknown): InviteFriendStatus | null {
  switch (apiErrorCode(error)) {
    case 'ALREADY_GOING':
      return 'ALREADY_GOING';
    case 'FRIEND_PRIVATE':
      return 'PRIVATE';
    default:
      return null;
  }
}

/** A refused invite, or a dialog that can't open, in the user's words. */
export function inviteErrorMessage(error: unknown): string {
  return apiErrorMessage(
    error,
    {
      [INVITE_LIMIT]: NO_INVITES_LEFT_TEXT,
      PROFILE_PRIVATE: INVITE_PRIVATE_TEXT,
      FRIEND_PRIVATE: 'Ha il profilo privato: non può essere invitato.',
      NOT_FRIENDS: 'Non siete più amici: si invita solo chi vi seguite a vicenda.',
      NOT_GOING: 'Puoi invitare solo alle serate a cui hai detto «Ci vado».',
      EVENT_NOT_INVITABLE: 'A questa serata non si può più invitare.',
      ALREADY_GOING: 'Ci va già.',
      404: 'Questa persona o questa serata non esiste più.',
    },
    'Non siamo riusciti a mandare l\'invito. Riprova tra poco.',
  );
}
