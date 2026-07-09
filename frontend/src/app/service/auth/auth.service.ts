import { Injectable } from '@angular/core';
import {LoginResponse, OidcSecurityService} from "angular-auth-oidc-client";
import {BehaviorSubject, Observable, of} from "rxjs";

const LOCAL_UUID_KEY = 'localUuid';
const LOCAL_USERNAME_KEY = 'localUsername';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  public initialized = new BehaviorSubject<boolean>(false);
  public loggedIn = new BehaviorSubject<boolean>(false);
  public localUsername: string | null = null;
  public localUuid: string | null = null;

  constructor(private oidcSecurityService: OidcSecurityService) {
    this.restoreLocalSession();
    this.configure();
  }

  private restoreLocalSession() {
    this.localUuid = localStorage.getItem(LOCAL_UUID_KEY);
    this.localUsername = localStorage.getItem(LOCAL_USERNAME_KEY);
    if (this.localUuid && this.localUsername) {
      this.loggedIn.next(true);
    }
  }

  private configure() {
    this.oidcSecurityService
      .checkAuth()
      .subscribe((loginResponse: LoginResponse) => {
        console.log('login response', loginResponse);
        this.initialized.next(true);
        if (loginResponse.isAuthenticated) {
          this.loggedIn.next(true);
        }
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
      return;
    }
    this.oidcSecurityService
      .logoff()
      .subscribe((result) => console.log(result));
  }

  public userData$(): Observable<Record<string, unknown>> {
    if (this.localUuid) {
      return of({ preferred_username: this.localUsername });
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
