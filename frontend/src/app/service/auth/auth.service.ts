import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LoginResponse, OidcSecurityService } from "angular-auth-oidc-client";
import { BehaviorSubject, Observable, of } from "rxjs";
import { map, switchMap, catchError, shareReplay, first } from "rxjs/operators";
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';

const LOCAL_UUID_KEY = 'localUuid';
const LOCAL_USERNAME_KEY = 'localUsername';

@Injectable({ providedIn: 'root' })
export class AuthService {
  public initialized = new BehaviorSubject<boolean>(false);
  public loggedIn = new BehaviorSubject<boolean>(false);
  public localUsername: string | null = null;
  public localUuid: string | null = null;

  constructor(
    private oidcSecurityService: OidcSecurityService,
    private router: Router,
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {
    this.restoreLocalSession();
    this.configure();
  }

  private restoreLocalSession() {
    this.localUuid = localStorage.getItem(LOCAL_UUID_KEY);
    this.localUsername = localStorage.getItem(LOCAL_USERNAME_KEY);
    if (this.localUuid && this.localUsername) {
      this.loggedIn.next(true);
      this.initialized.next(true);
    }
  }

  private configure() {
    if (this.localUuid) return;

    const isBrowser = isPlatformBrowser(this.platformId);

    if (isBrowser) {
      const url = window.location.href;
      const hasCallbackParams = url.includes('code=') || url.includes('state=');
      const hasOidcError = url.includes('?error=') || url.includes('&error=');
      console.log('[Auth] configure URL:', url, 'hasCallback:', hasCallbackParams);

      if (hasOidcError && !hasCallbackParams) {
        console.warn('[Auth] OIDC error in URL, redirecting to login');
        window.history.replaceState({}, '', window.location.pathname);
        this.router.navigate(['/login']);
        this.initialized.next(true);
        return;
      }
    }

    this.oidcSecurityService
      .checkAuth()
      .subscribe({
        next: (loginResponse: LoginResponse) => {
          console.log('[Auth] checkAuth result:', loginResponse);
          this.initialized.next(true);
          if (loginResponse.isAuthenticated) {
            this.loggedIn.next(true);
          } else if (loginResponse.errorMessage) {
            console.warn('[Auth] checkAuth error:', loginResponse.errorMessage);
            if (isBrowser && (window.location.href.includes('?error=') || window.location.href.includes('&error='))) {
              window.history.replaceState({}, '', window.location.pathname);
              this.router.navigate(['/login']);
            }
          }
        },
        error: (err) => {
          console.error('[Auth] checkAuth failed:', err);
          this.initialized.next(true);
          if (isBrowser) {
            this.router.navigate(['/login']);
          }
        },
      });
  }

  public login() {
    this.oidcSecurityService.authorize();
  }

  public loginLocal(username: string) {
    const uuid = crypto.randomUUID();
    localStorage.setItem(LOCAL_UUID_KEY, uuid);
    localStorage.setItem(LOCAL_USERNAME_KEY, username);
    this.localUuid = uuid;
    this.localUsername = username;
    this.initialized.next(true);
    this.loggedIn.next(true);
  }

  public logout() {
    if (this.localUuid) {
      localStorage.removeItem(LOCAL_UUID_KEY);
      localStorage.removeItem(LOCAL_USERNAME_KEY);
      this.localUuid = null;
      this.localUsername = null;
      this.loggedIn.next(false);
      this.router.navigate(['/login']);
      return;
    }
    this.oidcSecurityService
      .logoff()
      .subscribe((result) => console.log(result));
  }

  public userId$(): Observable<string> {
    if (this.localUuid) {
      return of(this.localUuid);
    }
    return this.oidcSecurityService.getUserData().pipe(
      map(data => (data['sub'] as string) || ''),
    );
  }

  public username$(): Observable<string> {
    if (this.localUuid) {
      return of(this.localUsername || '');
    }
    return this.oidcSecurityService.getUserData().pipe(
      first(),
      switchMap(() => this.http.get<{ username: string }>(`${environment.apiUrl}/profile/me`).pipe(
        map(p => p.username),
        catchError(() => this.oidcSecurityService.getUserData().pipe(
          map(data => (data['preferred_username'] as string) || (data['email'] as string) || ''),
        )),
      )),
      shareReplay(1),
    );
  }

  public userData$(): Observable<Record<string, unknown>> {
    if (this.localUuid) {
      return of({ preferred_username: this.localUsername, sub: this.localUuid, userId: this.localUuid });
    }
    return this.oidcSecurityService.getUserData();
  }

  public getAccessToken(): Observable<string | null> {
    if (this.localUuid) {
      const encoded = btoa(`${this.localUsername}:${this.localUuid}`);
      return of(`Local ${encoded}`);
    }
    return this.oidcSecurityService.getAccessToken();
  }

  public getIdToken$(): Observable<string> {
    return this.oidcSecurityService.getIdToken();
  }

  public isAuthenticated(): Observable<boolean> {
    if (this.localUuid) {
      return of(true);
    }
    return this.oidcSecurityService.isAuthenticated();
  }

  public isLocalAuth(): boolean {
    return this.localUuid !== null;
  }
}
