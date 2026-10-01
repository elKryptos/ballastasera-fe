import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenStorageService } from '../services/token-storage.service';
import { environment } from '../../../environments/environment';

/** Attaches the stored JWT as `Authorization: Bearer <token>` to requests to our own API only —
 *  third parties (Photon, map tiles) must never see it, and the extra header would also force a
 *  CORS preflight on every one of their requests. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(TokenStorageService).get();

  if (!token || !req.url.startsWith(environment.apiUrl)) return next(req);

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
