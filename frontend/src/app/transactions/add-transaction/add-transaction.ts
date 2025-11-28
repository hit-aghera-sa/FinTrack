import { Component, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { CategoryService } from '../../core/services/category';
import { TransactionService } from '../../core/services/transaction';

@Component({
  selector: 'app-add-transaction',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-transaction.html',
  styleUrls: ['./add-transaction.css']
})
export class AddTransaction implements OnInit {

  // signals
  private _title = signal('');
  private _amount = signal<number | null>(null);
  private _type = signal<'income' | 'expense'>('expense');
  private _categoryId = signal('');
  private _date = signal<string>(new Date().toISOString().split('T')[0]);
  private _note = signal('');
  private _errorMessage = signal<string | null>(null);

  get title() { return this._title(); }
  set title(v) { this._title.set(v); }

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

  categories = signal<any[]>([]);
  loading = signal(true);

  // 🔥 Filter categories based on selected type
  filteredCategories = computed(() =>
    this.categories().filter(cat => cat.type === this.type)
  );

  constructor(
    private authService: AuthService,
    private router: Router,
    private categoryService: CategoryService,
    private transactionService: TransactionService
  ) {

    // 🔥 When type changes, clear category if it doesn’t match the new type
    effect(() => {
      const cats = this.filteredCategories();
      const selected = this.categoryId;

      if (!cats.find(c => c._id === selected)) {
        this._categoryId.set(''); // reset selection
      }
    });

  }

  ngOnInit(): void {
    this.waitForAuth();
    this.loadCategories();
  }

  waitForAuth(): void {
    let attempts = 0;
    const check = () => {
      attempts++;
      if (this.authService.isAuthenticated()) return;

      if (attempts >= 10) {
        this.router.navigate(['/login']);
        return;
      }

      setTimeout(check, 120);
    };
    check();
  }

  loadCategories(): void {
    this.categoryService.getMyCategories().subscribe({
      next: (res) => {
        this.categories.set(res.data || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  submit(): void {
    this.errorMessage = null;

    if (!this.title.trim()) {
      this.errorMessage = 'Title is required';
      return;
    }

    if (!this.amount || this.amount <= 0) {
      this.errorMessage = 'Amount must be greater than zero';
      return;
    }

    if (!this.categoryId) {
      this.errorMessage = 'Please select a category';
      return;
    }

    const payload = {
      title: this.title.trim(),
      amount: this.amount,
      type: this.type,
      categoryId: this.categoryId,
      date: this.date,
      note: this.note.trim()
    };

    this.transactionService.createTransaction(payload).subscribe({
      next: () => this.router.navigate(['/transactions']),
      error: (err) => {
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
