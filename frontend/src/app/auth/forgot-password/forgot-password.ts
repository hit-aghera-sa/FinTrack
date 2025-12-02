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
      next: (res: any) => {
        this.loading = false;
        this.successMessage = res.message || "Reset link sent to your email";

        this.forgotPasswordForm.reset();

        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (err) => {
        this.loading = false;

        if (err.error?.message) this.errorMessage = err.error.message;
        else if (typeof err.error === 'string') this.errorMessage = err.error;
        else this.errorMessage = "Failed to send reset link";

        this.cdr.detectChanges();
      }
    });
  }

  backToLogin() {
    this.router.navigate(['/login']);
  }
}
