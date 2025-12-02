import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { CommonModule } from '@angular/common';
import { finalize, take } from 'rxjs/operators';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './login.html'
})
export class LoginComponent implements OnInit {

  loginForm: FormGroup;
  loading = false;
  errorMessage: string | null = null;
  private isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    if (typeof window !== 'undefined' && this.auth.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  submit(): void {
    if (this.isSubmitting) return;

    if (this.loginForm.invalid) {
      this.errorMessage = 'Please enter valid email and password';
      return;
    }

    this.errorMessage = null;
    this.isSubmitting = true;
    this.loading = true;

    const payload = this.loginForm.value;

    this.auth.login(payload)
      .pipe(
        take(1),
        finalize(() => {
          this.loading = false;
          this.isSubmitting = false;
        })
      )
      .subscribe({
        next: (res: any) => {
          localStorage.setItem('isAuthenticated', 'true');
          this.auth.saveUser(res.data);
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.errorMessage =
            err?.error?.message ||
            err?.error?.error?.message ||
            'Incorrect email or password';

          this.cdr.detectChanges();
        }
      });
  }
}
