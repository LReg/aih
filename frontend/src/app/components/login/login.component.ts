import { Component, OnInit } from '@angular/core';
import {FormsModule} from "@angular/forms";
import {AuthService} from "../../service/auth/auth.service";
import {AsyncPipe, NgIf} from "@angular/common";
import {Router, RouterLink} from "@angular/router";
import { environment } from '../../../environments/environment';
import { filter, switchMap, tap, take } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    NgIf,
    RouterLink,
    AsyncPipe,
    FormsModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  env = environment;
  localUsername = '';
  useLocal = false;

  constructor(
    public authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.authService.initialized.pipe(
      filter(v => v),
      take(1),
      switchMap(() => this.authService.isAuthenticated()),
      tap(loggedIn => {
        if (loggedIn) {
          const returnUrl = sessionStorage.getItem('returnUrl');
          sessionStorage.removeItem('returnUrl');
          this.router.navigateByUrl(returnUrl || '/');
        }
      }),
    ).subscribe();
  }

  loginLocal() {
    const name = this.localUsername.trim();
    if (!name) return;
    this.authService.loginLocal(name);
    const returnUrl = sessionStorage.getItem('returnUrl');
    sessionStorage.removeItem('returnUrl');
    this.router.navigateByUrl(returnUrl || '/');
  }
}
