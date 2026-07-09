import { Component } from '@angular/core';
import {FormsModule} from "@angular/forms";
import {AuthService} from "../../service/auth/auth.service";
import {AsyncPipe, NgIf} from "@angular/common";
import {Router, RouterLink} from "@angular/router";

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
    this.router.navigate(['/']);
  }
}
