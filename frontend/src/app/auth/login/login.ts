import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
})
export class Login {

  loginForm: FormGroup;
  loading = false;
  errorMessage = "";

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) 
  {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  submit() {
    if (this.loginForm.invalid) {
      this.errorMessage = "Please fill in all fields correctly";
      return;
    }

    this.loading = true;
    this.errorMessage = "";

    const loginData = this.loginForm.value;
    console.log("Sending login request...");

    this.authService.login(loginData).subscribe({
      next: (response) => {
        console.log("Login successful:", response);

        // Save authentication flag
        localStorage.setItem("isAuthenticated", "true");

        this.loading = false;

        // Redirect to dashboard
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        console.error("Login failed:", error);

        this.loading = false;

        if (error.status === 401) {
          this.errorMessage = "Incorrect email or password";
        } else {
          this.errorMessage = "Something went wrong. Please try again.";
        }
      }
    });
  }

}
