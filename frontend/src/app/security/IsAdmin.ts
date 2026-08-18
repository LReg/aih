import { CanActivateFn, Router } from "@angular/router";
import { inject } from "@angular/core";
import { OidcSecurityService } from "angular-auth-oidc-client";
import { map } from "rxjs";

const PROJECT_ROLES_CLAIM = 'urn:zitadel:iam:org:project:roles';

/**
 * UX-only gate — the real enforcement is the backend's AdminController
 * (returns 403 for non-admins). This only decides whether to show the page
 * at all. Reads the *access* token payload, the same one the backend checks
 * via the userinfo endpoint's role claim.
 */
export const isAdmin: CanActivateFn = () => {
  const oidc = inject(OidcSecurityService);
  const router = inject(Router);

  return oidc.getPayloadFromAccessToken().pipe(
    map((payload: Record<string, unknown>) => {
      const roles = payload?.[PROJECT_ROLES_CLAIM] as Record<string, unknown> | undefined;
      if (roles && 'admin' in roles) {
        return true;
      }
      return router.createUrlTree(['/']);
    }),
  );
};
