import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TransactionService } from '../core/services/transaction';
import { AuthService } from '../core/services/auth';

@Component({
  selector: 'app-transactions-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './transactions.html',
  styleUrls: ['./transactions.css']
})
export class TransactionsPage implements OnInit {

  transactions = signal<any[]>([]);
  loading = signal(true);

  noteTarget = signal<any | null>(null);
  deleteTarget = signal<any | null>(null);

  constructor(
    private transactionService: TransactionService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loadTransactions();
  }

  loadTransactions(): void {
    this.loading.set(true);

    this.transactionService.getMyTransactions().subscribe({
      next: (res) => {

        // Normalize populated data + ensure lowercase type
        const cleaned = (res.data || []).map((t: any) => ({
          ...t,
          type: t.type?.toLowerCase() || '',
          categoryId: t.categoryId || null
        }));

        this.transactions.set(cleaned);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  // Stats
  totalIncome = computed(() =>
    this.transactions().filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  );

  totalExpense = computed(() =>
    this.transactions().filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  );

  balance = computed(() => this.totalIncome() - this.totalExpense());

  // Pagination
  currentPage = signal(1);
  pageSize = 9;

  totalPages = computed(() =>
    Math.ceil(this.transactions().length / this.pageSize)
  );

  paginatedTransactions = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.transactions().slice(start, start + this.pageSize);
  });

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(v => v + 1);
    }
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update(v => v - 1);
    }
  }

  goToAdd() {
    this.router.navigate(['/add-transaction']);
  }

  editTransaction(t: any) {
    this.router.navigate(['/edit-transaction', t._id]);
  }

  openDelete(t: any) {
    this.deleteTarget.set(t);
  }

  closeDelete() {
    this.deleteTarget.set(null);
  }

  confirmDelete() {
    const t = this.deleteTarget();
    if (!t) return;

    this.transactionService.deleteTransaction(t._id).subscribe({
      next: () => {
        this.transactions.set(
          this.transactions().filter(x => x._id !== t._id)
        );
        this.closeDelete();
      }
    });
  }

  openNote(txn: any) {
    this.noteTarget.set(txn);
  }

  closeNote() {
    this.noteTarget.set(null);
  }

  logout() {
    this.authService.logout();
  }
}
