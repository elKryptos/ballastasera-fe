import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenStorageService } from '../services/token-storage.service';

/** Attaches the stored JWT as `Authorization: Bearer <token>` to every request. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(TokenStorageService).get();

  if (!token) return next(req);

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
