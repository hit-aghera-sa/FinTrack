import { Component, OnInit, OnDestroy, signal, computed, effect, inject } from '@angular/core';
import { Subject, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { LoggingService } from '../../core/services/logging.service';
import { CategoryService } from '../../core/services/category';
import { TransactionService } from '../../core/services/transaction';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-add-transaction',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-transaction.html',
  styleUrls: ['./add-transaction.css'],
})
export class AddTransaction implements OnInit, OnDestroy {
  private _amount = signal<number | null>(null);
  private _type = signal<'income' | 'expense'>('expense');
  private _categoryId = signal('');
  private _date = signal<string>(new Date().toISOString().split('T')[0]);
  private _note = signal('');
  private _errorMessage = signal<string | null>(null);

  selectedFiles: File[] = [];

  get amount() {
    return this._amount();
  }
  set amount(v) {
    this._amount.set(v);
  }

  get type() {
    return this._type();
  }
  set type(v) {
    this._type.set(v);
  }

  get categoryId() {
    return this._categoryId();
  }
  set categoryId(v) {
    this._categoryId.set(v);
  }

  get date() {
    return this._date();
  }
  set date(v) {
    this._date.set(v);
  }

  get note() {
    return this._note();
  }
  set note(v) {
    this._note.set(v);
  }

  get errorMessage() {
    return this._errorMessage();
  }
  set errorMessage(v) {
    this._errorMessage.set(v);
  }

  categories = signal<any[]>([]);
  loading = signal(true);

  // Filter categories by income/expense
  filteredCategories = computed(() => this.categories().filter((cat) => cat.type === this.type));

  private destroy$ = new Subject<void>();
  private readonly maxAuthCheckAttempts = 10;
  private readonly checkIntervalMs = 120;

  // Inject services
  private authService = inject(AuthService);
  private router = inject(Router);
  private categoryService = inject(CategoryService);
  private transactionService = inject(TransactionService);
  private http = inject(HttpClient);
  private loggingService = inject(LoggingService);

  constructor() {
    // Reset category if type changes
    effect(() => {
      const cats = this.filteredCategories();
      const selected = this.categoryId;

      if (!cats.find((c) => c._id === selected)) {
        this._categoryId.set('');
      }
    });
  }

  ngOnInit(): void {
    this.waitForAuth();
    this.loadCategories();
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
            this.router.navigate(['/login']).catch((err) => {
              this.loggingService.error('Error navigating to login', err as Error);
            });
          }
        },
        error: (err: unknown) => {
          this.loggingService.error('Error in auth check', err as Error);
          this.router.navigate(['/login']).catch((err) => {
            this.loggingService.error('Error navigating to login', err as Error);
          });
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
  }

  loadCategories(): void {
    this.categoryService.getMyCategories().subscribe({
      next: (res) => {
        this.categories.set(res.data || []);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loggingService.error('Failed to load categories', err as Error);
        this.loading.set(false);
      },
    });
  }

  onFilesSelected(event: any) {
    const files: FileList = event.target.files;

    for (let i = 0; i < files.length; i++) {
      if (this.selectedFiles.length >= 5) break;
      this.selectedFiles.push(files[i]);
    }
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  submit(): void {
    this.errorMessage = null;

    if (!this.amount || this.amount <= 0) {
      this.errorMessage = 'Amount must be greater than zero';
      return;
    }

    if (!this.categoryId) {
      this.errorMessage = 'Please select a category';
      return;
    }

    const payload = {
      amount: this.amount,
      categoryId: this.categoryId,
      date: this.date,
      description: this.note.trim(),
    };

    this.transactionService.createTransaction(payload).subscribe({
      next: (res) => {
        const transactionId = res.data._id;

        if (this.selectedFiles.length === 0) {
          this.router.navigate(['/transactions']);
          return;
        }

        const formData = new FormData();
        this.selectedFiles.forEach((f) => formData.append('files', f));

        this.http
          .post(`http://localhost:5001/api/attachment/transaction/${transactionId}`, formData, {
            withCredentials: true,
          })
          .subscribe({
            next: () => this.router.navigate(['/transactions']),
            error: () => this.router.navigate(['/transactions']),
          });
      },

      error: (err) => {
        this.errorMessage = err?.error?.message || 'Something went wrong.';
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.authService.logout();
  }
}
