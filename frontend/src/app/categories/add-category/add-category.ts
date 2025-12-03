import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CategoryService } from '../../core/services/category';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-add-category',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-category.html',
  styleUrls: ['./add-category.css']
})
export class AddCategory implements OnInit {

  // signals
  private _name = signal('');
  private _type = signal<'income' | 'expense'>('expense');
  private _errorMessage = signal<string | null>(null);

  // getters / setters
  get name() { return this._name(); }
  set name(val: string) { this._name.set(val); }

  get type() { return this._type(); }
  set type(val: 'income' | 'expense') { this._type.set(val); }

  get errorMessage() { return this._errorMessage(); }
  set errorMessage(val: string | null) { this._errorMessage.set(val); }

  constructor(
    private categoryService: CategoryService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.waitForAuth();
  }

  waitForAuth(): void {
    let attempts = 0;

    const check = (): void => {
      attempts++;

      if (this.authService.isAuthenticated()) {
        return void 0;
      }

      if (attempts >= 10) {
        this.router.navigate(['/login']);
        return void 0;
      }

      setTimeout(check, 120);
      return void 0;
    };
    check();
  }


  submit(): void {
    this.errorMessage = null;

    if (!this.name.trim()) {
      this.errorMessage = 'Category name is required';
      return;
    }

    const payload = {
      name: this.name.trim(),
      type: this.type
    };

    this.categoryService.createCategory(payload).subscribe({
      next: () => this.router.navigate(['/categories']),
      error: err => {
        this.errorMessage = err?.error?.message || 'Something went wrong.';
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.authService.logout();
  }
}
