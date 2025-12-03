import { Component, ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { timer, Subject } from 'rxjs';
import { takeUntil, take } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth';
import { LoggingService } from '../../core/services/logging.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.html',
})
export class ResetPassword implements OnInit, OnDestroy {

  resetForm: FormGroup;
  loading = false;
  errorMessage = "";
  successMessage = "";
  token = "";

  private destroy$ = new Subject<void>();
  private readonly redirectDelay = 2500; // 2.5 seconds

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private loggingService: LoggingService
  ) {
    this.resetForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      passwordConfirm: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || "";
  }

  submit(): void {
    if (this.resetForm.invalid) {
      this.errorMessage = "Please enter valid passwords";
      return;
    }

    const { password, passwordConfirm } = this.resetForm.value;

    if (password !== passwordConfirm) {
      this.errorMessage = "Passwords do not match";
      return;
    }

    this.loading = true;
    this.errorMessage = "";
    this.successMessage = "";

    this.authService.resetPassword(this.token, { password, passwordConfirm }).subscribe({
      next: () => {
        this.loading = false;
        this.successMessage = "Password updated successfully!";
        this.resetForm.reset();

        // Use RxJS timer for the redirect
        timer(this.redirectDelay)
          .pipe(
            take(1),
            takeUntil(this.destroy$)
          )
          .subscribe({
            next: () => this.router.navigate(['/login']),
            error: (err) => {
              this.loggingService.error('Error during navigation after password reset', err);
              this.router.navigate(['/login']);
            }
          });
      },
      error: (err) => {
        this.loading = false;

        if (err.error?.message) this.errorMessage = err.error.message;
        else this.errorMessage = "Failed to reset password";

        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
