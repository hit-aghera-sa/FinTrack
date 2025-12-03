import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CategoryService } from '../../core/services/category';
import { AuthService } from '../../core/services/auth';
import { LoggingService } from '../../core/services/logging.service';

@Component({
  selector: 'app-add-category',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-category.html',
  styleUrls: ['./add-category.css']
})
export class AddCategory implements OnInit, OnDestroy {

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

  private destroy$ = new Subject<void>();
  private readonly maxAuthCheckAttempts = 10;
  private readonly checkIntervalMs = 120;

  constructor(
    private categoryService: CategoryService,
    private router: Router,
    private authService: AuthService,
    private loggingService: LoggingService
  ) {}

  ngOnInit(): void {
    this.waitForAuth();
  }

  waitForAuth(): void {
    let attempts = 0;
    
    timer(0, this.checkIntervalMs)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          if (this.authService.isAuthenticated()) {
            return;
          }
          
          attempts++;
          if (attempts >= this.maxAuthCheckAttempts) {
            this.router.navigate(['/login']);
          }
        },
        error: (err) => {
          this.loggingService.error('Error in auth check', err);
          this.router.navigate(['/login']);
        }
      });
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
