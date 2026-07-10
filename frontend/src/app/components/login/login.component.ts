import { Component } from '@angular/core';
import {FormsModule} from "@angular/forms";
import {AuthService} from "../../service/auth/auth.service";
import {AsyncPipe, NgIf} from "@angular/common";
import {Router, RouterLink} from "@angular/router";
import { environment } from '../../../environments/environment';

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
export class LoginComponent {
  env = environment;
  localUsername = '';
  useLocal = false;

  constructor(
    public authService: AuthService,
    private router: Router,
  ) {}

  loginLocal() {
    const name = this.localUsername.trim();
    if (!name) return;
    this.authService.loginLocal(name);
    const returnUrl = sessionStorage.getItem('returnUrl');
    sessionStorage.removeItem('returnUrl');
    this.router.navigateByUrl(returnUrl || '/');
  }
}
