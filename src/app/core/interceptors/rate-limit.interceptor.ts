import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ToastService } from '../services/toast.service';
import { apiErrorCode } from '../utils/api-errors';

/** The backend's general limit (RateLimitFilter: so many requests a minute per user or IP). */
export const RATE_LIMITED = 'RATE_LIMITED';
export const RATE_LIMITED_MESSAGE = 'Troppe richieste, riprova tra poco.';

/** A 429 from our API with RATE_LIMITED tells the user to slow down, wherever it came from: no
 * page has to handle it. The error still reaches the caller, which undoes what it showed (an
 * optimistic "Segui", a spinner). Other 429s are a rule of their own (INVITE_LIMIT, the invites a
 * day) and their page says it in its own words. Retry-After isn't exposed to the browser (CORS),
 * so the message gives no seconds. */
export const rateLimitInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);
  const toasts = inject(ToastService);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (apiErrorCode(error) === RATE_LIMITED) toasts.show(RATE_LIMITED_MESSAGE);
      return throwError(() => error);
    }),
  );
};
