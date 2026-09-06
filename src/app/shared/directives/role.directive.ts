import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from "@angular/core";
import { AuthService } from "../../core/services/auth.service";
import { UserRole } from "../../core/models/user.model";

@Directive({
  selector: '[appRole]'
})
export class RoleDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly auth = inject(AuthService);

  readonly appRole = input.required<UserRole | UserRole []>();

  constructor() {
    effect(() => {
      const allowed = Array.isArray(this.appRole()) ? (this.appRole() as UserRole[]) : [this.appRole() as UserRole];
      const role = this.auth.currentUser()?.role;

      this.viewContainer.clear();
      if (role && allowed.includes(role)) {
        this.viewContainer.createEmbeddedView(this.templateRef);
      }
    })
  }
}