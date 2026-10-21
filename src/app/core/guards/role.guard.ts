import { CanMatchFn } from "@angular/router";
import { UserRole } from "../models/user.model";
import { AuthService } from "../services/auth.service";
import { inject } from "@angular/core";
import { map } from "rxjs";

/** Waits for /auth/me to confirm the session (AuthService.sessionChecked):
 * the user stored from the last visit shows at once everywhere else, but a
 * guarded page opens only on a token the backend still takes. */
export function roleGuard(...roles: UserRole[]): CanMatchFn {
  return () => {
    const auth = inject(AuthService);
    return auth.sessionChecked().pipe(
      map(() => {
        const role = auth.currentUser()?.role;
        return !!role && roles.includes(role);
      }),
    );
  }
}
