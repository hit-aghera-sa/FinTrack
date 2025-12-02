import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.html',
})
export class ResetPassword {

  resetForm: FormGroup;
  loading = false;
  errorMessage = "";
  successMessage = "";
  token = "";

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) 
  {
    this.resetForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      passwordConfirm: ['', [Validators.required]]
    });
  }

  ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') || "";
  }

  submit() {
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

        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2500);
      },
      error: (err) => {
        this.loading = false;

        if (err.error?.message) this.errorMessage = err.error.message;
        else this.errorMessage = "Failed to reset password";

        this.cdr.detectChanges();
      }
    });
  }
}
