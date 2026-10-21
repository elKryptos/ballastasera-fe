import { HttpContext, HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenStorageService } from '../services/token-storage.service';
import { environment } from '../../../environments/environment';

/** Marks a request to one of the API's public GETs (permitAll in the backend's SecurityConfig),
 *  which answer the same with or without a session: it goes without the token. With it, the GET
 *  is no longer a "simple" CORS request and costs a preflight first, the backend looks the token
 *  and its user up for nothing, and no shared cache may keep the answer. A public request left
 *  unmarked just carries the token, as before. */
export const PUBLIC_API = new HttpContextToken<boolean>(() => false);

/** HttpClient's `context` option for a public GET — see PUBLIC_API. */
export function publicApi(): HttpContext {
  return new HttpContext().set(PUBLIC_API, true);
}

/** Attaches the stored JWT as `Authorization: Bearer <token>` to requests to our own API only —
 *  third parties (Photon, map tiles) must never see it, and the extra header would also force a
 *  CORS preflight on every one of their requests. Nor to its public GETs (PUBLIC_API). */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(PUBLIC_API) || !req.url.startsWith(environment.apiUrl)) return next(req);

  const token = inject(TokenStorageService).get();
  if (!token) return next(req);

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
