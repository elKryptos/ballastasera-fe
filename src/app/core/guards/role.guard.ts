import { CanMatchFn } from "@angular/router";
import { UserRole } from "../models/user.model";
import { AuthService } from "../services/auth.service";
import { inject } from "@angular/core";

export function roleGuard(...roles: UserRole[]): CanMatchFn {
  return () => {
    const role = inject(AuthService).currentUser()?.role;
    return !!role && roles.includes(role);
  }
}