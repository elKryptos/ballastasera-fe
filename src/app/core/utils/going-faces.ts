import { EventCardDto } from '../models/event.model';
import { UserDto } from '../models/user.model';

/** Faces the backend sends per card in goingAvatars (AVATAR_PREVIEW_LIMIT
 * in EventAttendanceServiceImpl). */
export const GOING_FACES = 3;

/** The visitor's face among an event's goingAvatars: their photo, only if
 * they show their profile — the backend lists no one else. */
export function publicAvatar(user: UserDto | null): string | null {
  return user?.showProfilePublic ? user.avatarUrl : null;
}

/** An event card after the visitor's own +1/-1 on likes or going, as the
 * backend will have it: going, their face joins goingAvatars too, last — the
 * backend lists them in the order they said they'd go, so not at all once
 * it's full — and leaves it when they no longer are. */
export function withCountChange(
  event: EventCardDto,
  field: 'likesCount' | 'goingCount',
  delta: number,
  ownAvatar: string | null,
): EventCardDto {
  const bumped = { ...event, [field]: Math.max(0, event[field] + delta) };
  if (field !== 'goingCount' || !ownAvatar) return bumped;
  const others = (event.goingAvatars ?? []).filter((url) => url !== ownAvatar);
  const joins = delta > 0 && others.length < GOING_FACES;
  return { ...bumped, goingAvatars: joins ? [...others, ownAvatar] : others };
}
