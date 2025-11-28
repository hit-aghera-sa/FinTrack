import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
})
export class ForgotPassword {

  forgotPasswordForm: FormGroup;
  loading = false;
  errorMessage = "";
  successMessage = "";

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) 
  {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  submit() {
    if (this.forgotPasswordForm.invalid) {
      this.errorMessage = "Please enter a valid email address";
      return;
    }

    this.loading = true;
    this.errorMessage = "";
    this.successMessage = "";

    const email = this.forgotPasswordForm.get('email')?.value;
    this.authService.forgotPassword(email).subscribe({
      next: (response: any) => {
        this.loading = false;
        this.successMessage = response.message || "Password reset link has been sent to your email";
        this.forgotPasswordForm.reset();
        // Optionally redirect to login after 3 seconds
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (err: any) => {
        this.loading = false;
        // Extract error message from different possible response structures
        if (err.error?.message) {
          this.errorMessage = err.error.message;
        } else if (err.error?.error?.message) {
          this.errorMessage = err.error.error.message;
        } else if (typeof err.error === 'string') {
          this.errorMessage = err.error;
        } else {
          this.errorMessage = err.statusText || "Failed to send reset link";
        }
        // Trigger change detection to update the UI
        this.cdr.detectChanges();
      }
    });
  }

  backToLogin() {
    this.router.navigate(['/login']);
  }
}
