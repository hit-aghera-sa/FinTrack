import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './signup.html',
})
export class Signup {

  signupForm: FormGroup;
  loading = false;
  errorMessage = "";

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) 
  {
    this.signupForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      passwordConfirm: ['', [Validators.required]]
    }, { validators: this.passwordMatch });
  }

  // ✅ password match validator
  passwordMatch(form: FormGroup) {
    const pass = form.get('password')?.value;
    const confirm = form.get('passwordConfirm')?.value;
    return pass === confirm ? null : { mismatch: true };
  }

  submit() {
    if (this.signupForm.invalid || this.signupForm.errors?.['mismatch']) {
      this.errorMessage = "Passwords do not match";
      return;
    }

    this.loading = true;
    this.errorMessage = "";

    this.authService.signup(this.signupForm.value).subscribe({
      next: () => {
        this.loading = false;
        // Redirect to dashboard after successful signup
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        // Extract error message from different possible response structures
        if (err.error?.message) {
          this.errorMessage = err.error.message;
        } else if (err.error?.error?.message) {
          this.errorMessage = err.error.error.message;
        } else if (typeof err.error === 'string') {
          this.errorMessage = err.error;
        } else {
          this.errorMessage = err.statusText || "Signup failed";
        }
        // Trigger change detection to update the UI
        this.cdr.detectChanges();
      }
    });
  }
}
