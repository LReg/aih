import { HttpInterceptorFn } from '@angular/common/http';
import {inject} from "@angular/core";
import {AuthService} from "../service/auth/auth.service";
import {of, switchMap} from "rxjs";

export const idTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  return auth.isAuthenticated().pipe(
    switchMap((isAuthenticated: boolean) => {
      if (isAuthenticated) {
        return auth.getAccessToken();
      }
      return of(null);
    }),
    switchMap((token: string | null) => {
      if (token) {
        req = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
      }
      return of(req);
    }),
    switchMap((req) => {
      return next(req);
    }
  ));
};
