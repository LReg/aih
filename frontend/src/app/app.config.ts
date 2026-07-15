import {ApplicationConfig, provideZoneChangeDetection} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import {provideHttpClient, withInterceptors} from "@angular/common/http";
import {authInterceptor, LogLevel, provideAuth} from "angular-auth-oidc-client";
import {environment} from "../environments/environment";
import {idTokenInterceptor} from "./interceptors/idTokenInterceptor";


export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor(), idTokenInterceptor])),
    provideAuth({
      config: {
        authority: environment.authUrl,
        redirectUrl: environment.baseUrl + '/home',
        postLoginRoute: '/',
        unauthorizedRoute: '/login',
        postLogoutRedirectUri: window.location.origin,
        clientId: environment.clientId,
        scope: 'openid profile email offline_access',
        responseType: 'code',
        silentRenew: true,
        useRefreshToken: true,
        logLevel: LogLevel.Debug,
        secureRoutes: [environment.apiUrl],
      },
    }),
  ],
};
