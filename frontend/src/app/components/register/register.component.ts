import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { GameApiService } from '../../service/game-api.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  email = '';
  name = '';
  password = '';
  confirmPassword = '';
  loading = false;
  error = '';
  success = false;

  constructor(
    private api: GameApiService,
    private router: Router,
  ) {}

  submit() {
    this.error = '';

    if (!this.email || !this.password || !this.confirmPassword) {
      this.error = 'All fields are required';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match';
      return;
    }

    if (this.password.length < 8) {
      this.error = 'Password must be at least 8 characters';
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.error = 'Invalid email format';
      return;
    }

    this.loading = true;
    this.api.register(this.email, this.name, this.password).subscribe({
      next: () => {
        this.success = true;
        this.loading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.error = err.error?.message || 'Registration failed';
        this.loading = false;
      },
    });
  }
}
