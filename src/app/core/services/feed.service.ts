import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { endpoints } from '../api/endpoints';
import { FeedDto, SuggestionDto } from '../models/social.model';

/** How many people "Scopri" asks for (the backend allows 1–20). */
const SUGGESTIONS = 10;

/** The Amici tab's "Attività" and "Scopri" (social phase 5). Worked out on each request from the
 * follows and the "Ci vado", with no history kept: nothing is cached here either. */
@Service()
export class FeedService {
  private readonly http = inject(HttpClient);

  /** "Stasera escono" (tonight: on now or starting before 06:00 Italian time) and "Novità" (7 days). */
  getFeed(): Observable<FeedDto> {
    return this.http.get<FeedDto>(`${environment.apiUrl}${endpoints.users.myFeed}`);
  }

  /** People the viewer may know, best first: sharing a night, looking for a partner, friends of friends. */
  getSuggestions(limit = SUGGESTIONS): Observable<SuggestionDto[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<SuggestionDto[]>(`${environment.apiUrl}${endpoints.users.mySuggestions}`, { params });
  }
}
