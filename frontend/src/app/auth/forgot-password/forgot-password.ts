import { Component, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, timer } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth';
import { LoggingService } from '../../core/services/logging.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
})
export class ForgotPassword implements OnDestroy {
  forgotPasswordForm: FormGroup;
  loading = false;
  errorMessage = '';
  successMessage = '';

  private destroy$ = new Subject<void>();
  private readonly redirectDelay = 3000; // 3 seconds

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private loggingService: LoggingService,
  ) {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  submit() {
    if (this.forgotPasswordForm.invalid) {
      this.errorMessage = 'Please enter a valid email address';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const email = this.forgotPasswordForm.get('email')?.value;

    this.authService.forgotPassword(email).subscribe({
      next: (res: any) => {
        this.loading = false;
        this.successMessage = res.message || 'Reset link sent to your email';

        this.forgotPasswordForm.reset();

        // Use RxJS timer for the redirect
        timer(this.redirectDelay)
          .pipe(take(1), takeUntil(this.destroy$))
          .subscribe({
            next: () => this.router.navigate(['/login']),
            error: (err) => {
              this.loggingService.error('Error during navigation after forgot password', err);
              this.router.navigate(['/login']);
            },
          });
      },
      error: (err) => {
        this.loading = false;

        if (err.error?.message) this.errorMessage = err.error.message;
        else if (typeof err.error === 'string') this.errorMessage = err.error;
        else this.errorMessage = 'Failed to send reset link';

        this.cdr.detectChanges();
      },
    });
  }

  backToLogin(): void {
    this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
