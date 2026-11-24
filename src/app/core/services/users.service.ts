import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { cursorParams } from '../api/cursor-params';
import { endpoints } from '../api/endpoints';
import { EventCardDto } from '../models/event.model';
import { CursorPage, PageCursor } from '../models/page.model';
import { UsernameAvailabilityDto } from '../models/social.model';
import { UserDto, UserProfileDto } from '../models/user.model';
import { AuthService } from './auth.service';

/** Nights per page in someone's profile. */
const NIGHTS_PAGE_SIZE = 10;

/** Other people's profiles, and the parts of one's own saved apart from the form (/auth/me, in
 * AuthService): the photo, the username and "Ricevi email". Each of those keeps the session's user
 * up to date, so every page shows the new value at once. */
@Service()
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = environment.apiUrl;

  /** Signed-in users only. 404 when the profile isn't public (any more), there's a block, or its
   * user is banned or gone: the same 404 for all. */
  getProfile(userId: string): Observable<UserProfileDto> {
    return this.http.get<UserProfileDto>(`${this.api}${endpoints.users.profile(userId)}`);
  }

  /** /@username: the same profile and the same 404s, also when nobody has that name. */
  getProfileByUsername(username: string): Observable<UserProfileDto> {
    return this.http.get<UserProfileDto>(`${this.api}${endpoints.users.profileByUsername(username)}`);
  }

  /** "Le sue prossime serate" (past: the ones over). Empty, total 0, when they don't show them to
   * the viewer. */
  getAttendance(userId: string, past: boolean, cursor: PageCursor | null = null): Observable<CursorPage<EventCardDto>> {
    const params = cursorParams(cursor, NIGHTS_PAGE_SIZE, new HttpParams().set('past', past));
    return this.http.get<CursorPage<EventCardDto>>(`${this.api}${endpoints.users.attendance(userId)}`, { params });
  }

  /** While "Nome utente" is typed: lower case, as the backend doesn't normalize. One's own counts as
   * available. */
  isUsernameAvailable(username: string): Observable<UsernameAvailabilityDto> {
    const params = new HttpParams().set('u', username);
    return this.http.get<UsernameAvailabilityDto>(`${this.api}${endpoints.users.usernameAvailable}`, { params });
  }

  /** Picks, changes or (null) drops the username. 409 USERNAME_TAKEN / USERNAME_RESERVED. */
  setUsername(username: string | null): Observable<void> {
    return this.http
      .patch<void>(`${this.api}${endpoints.users.myUsername}`, { username })
      .pipe(tap(() => this.auth.patchUser({ username })));
  }

  /** The user's own photo, saved at once (JPG, PNG or WebP up to 5 MB: 413 / 415 otherwise). */
  uploadAvatar(file: File): Observable<UserDto> {
    const formData = new FormData();
    formData.append('avatar', file);
    return this.http
      .patch<UserDto>(`${this.api}${endpoints.users.myAvatar}`, formData)
      .pipe(tap((user) => this.auth.setUser(user)));
  }

  /** "Usa la foto di Google" or "Togli la foto": the own photo, if any, is deleted. */
  setAvatarSource(source: 'GOOGLE' | 'NONE'): Observable<UserDto> {
    return this.http
      .patch<UserDto>(`${this.api}${endpoints.users.myAvatarSource}`, { source })
      .pipe(tap((user) => this.auth.setUser(user)));
  }

  /** "Ricevi email": only new friends and invites are ever emailed. */
  setEmailNotifications(enabled: boolean): Observable<void> {
    return this.http
      .patch<void>(`${this.api}${endpoints.users.myEmailNotifications}`, { enabled })
      .pipe(tap(() => this.auth.patchUser({ emailNotifications: enabled })));
  }
}
