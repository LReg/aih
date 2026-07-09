import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  GuardResult,
  MaybeAsync,
  Router,
  RouterStateSnapshot
} from "@angular/router";
import {inject} from "@angular/core";
import {AuthService} from "../service/auth/auth.service";
import {filter, map, switchMap} from "rxjs";


export const isLoggedIn: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): MaybeAsync<GuardResult> => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth) {
    console.log('auth service not available');
    return router.createUrlTree(['/login']);
  }
  if (auth.isLocalAuth()) {
    return true;
  }
  return auth.initialized.pipe(
    filter(initialized => initialized),
    switchMap(() => auth.isAuthenticated()),
    map(loggedIn => {
      if (loggedIn) {
        return true;
      } else {
        return router.createUrlTree(['/login']);
      }
    })
  );
}
