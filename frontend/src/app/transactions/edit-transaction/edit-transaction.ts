import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { Subject, timer } from 'rxjs';
import { takeUntil, take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { CategoryService } from '../../core/services/category';
import { TransactionService } from '../../core/services/transaction';
import { LoggingService } from '../../core/services/logging.service';

@Component({
  selector: 'app-edit-transaction',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-transaction.html',
  styleUrls: ['./edit-transaction.css']
})
export class EditTransaction implements OnInit, OnDestroy {

  // signals
  private _amount = signal<number | null>(null);
  private _type = signal<'income' | 'expense'>('expense');
  private _categoryId = signal('');
  private _date = signal<string>('');
  private _note = signal('');
  private _errorMessage = signal<string | null>(null);

  categories = signal<any[]>([]);
  loading = signal(true);
  transactionId: string = '';

  // getters / setters 

  get amount() { return this._amount(); }
  set amount(v) { this._amount.set(v); }

  get type() { return this._type(); }
  set type(v) { this._type.set(v); }

  get categoryId() { return this._categoryId(); }
  set categoryId(v) { this._categoryId.set(v); }

  get date() { return this._date(); }
  set date(v) { this._date.set(v); }

  get note() { return this._note(); }
  set note(v) { this._note.set(v); }

  get errorMessage() { return this._errorMessage(); }
  set errorMessage(v) { this._errorMessage.set(v); }

  filteredCategories = computed(() =>
    this.categories().filter(cat => cat.type === this.type)
  );

  private destroy$ = new Subject<void>();
  private readonly maxAuthCheckAttempts = 10;
  private readonly checkIntervalMs = 120;
  
  // Inject services
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private categoryService = inject(CategoryService);
  private transactionService = inject(TransactionService);
  private loggingService = inject(LoggingService);

  constructor() {}

  ngOnInit(): void {
    this.waitForAuth();

    this.transactionId = this.route.snapshot.params['id'];
    this.loadCategories();
    this.loadTransaction();
  }

  // Wait for Auth using RxJS timer
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

  loadCategories(): void {
    this.categoryService.getMyCategories().subscribe({
      next: (res) => {
        this.categories.set(res.data || []);
      }
    });
  }

  loadTransaction(): void {
    this.transactionService.getMyTransactions().subscribe({
      next: (res) => {
        const tx = res.data.find((t: any) => t._id === this.transactionId);
        if (!tx) return;

        this.amount = tx.amount;
        this.type = tx.type;
        this.categoryId = tx.categoryId;
        this.date = tx.date.split('T')[0];
        this.note = tx.note || '';

        this.loading.set(false);
      }
    });
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
      type: this.type,
      categoryId: this.categoryId,
      date: this.date,
      description: this.note.trim()
    };

    this.transactionService.updateTransaction(this.transactionId, payload).subscribe({
      next: () => this.router.navigate(['/transactions']),
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Something went wrong.';
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/transactions']);
  }

  logout(): void {
    this.authService.logout();
  }
}
