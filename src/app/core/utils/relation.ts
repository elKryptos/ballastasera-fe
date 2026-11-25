import { SocialRelation } from '../models/social.model';

/** The viewer follows them: "Segui già" or "Amici". */
export function iFollow(relation: SocialRelation | null | undefined): boolean {
  return relation === 'FOLLOWING' || relation === 'MUTUAL';
}

/** They follow the viewer: "Ti segue", "Ricambia" or "Amici". */
export function followsMe(relation: SocialRelation | null | undefined): boolean {
  return relation === 'FOLLOWED_BY' || relation === 'MUTUAL';
}

/** Friends: both follow each other. */
export function isFriend(relation: SocialRelation | null | undefined): boolean {
  return relation === 'MUTUAL';
}

/** The relation once the viewer follows them: "Ricambia" turns into "Amici". */
export function afterFollow(relation: SocialRelation): SocialRelation {
  return followsMe(relation) ? 'MUTUAL' : 'FOLLOWING';
}

/** The relation once the viewer stops following them: friends go back to "Ricambia". */
export function afterUnfollow(relation: SocialRelation): SocialRelation {
  return followsMe(relation) ? 'FOLLOWED_BY' : 'NONE';
}
