import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { endpoints } from '../api/endpoints';
import { UserProfileDto } from '../models/user.model';

/** Other people's profiles. One's own is AuthService's (/auth/me). */
@Service()
export class UsersService {
  private readonly http = inject(HttpClient);

  /** Signed-in users only. 404 when the profile isn't public (any more), or its user is gone. */
  getProfile(userId: string): Observable<UserProfileDto> {
    return this.http.get<UserProfileDto>(`${environment.apiUrl}${endpoints.users.profile(userId)}`);
  }
}
