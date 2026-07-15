import { HttpInterceptorFn } from '@angular/common/http';

export const idTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const localUuid = localStorage.getItem('localUuid');
  const localUsername = localStorage.getItem('localUsername');
  if (!localUuid || !localUsername) {
    return next(req);
  }
  const token = btoa(`${localUsername}:${localUuid}`);
  req = req.clone({ setHeaders: { Authorization: `Local ${token}` } });
  return next(req);
};
