import { HttpInterceptorFn } from '@angular/common/http';
import {inject} from "@angular/core";
import {AuthService} from "../service/auth/auth.service";
import {switchMap} from "rxjs";

export const idTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  if (!auth.isLocalAuth()) {
    return next(req);
  }
  return auth.getAccessToken().pipe(
    switchMap((token: string | null) => {
      if (token) {
        req = req.clone({ setHeaders: { Authorization: token } });
      }
      return next(req);
    })
  );
};
