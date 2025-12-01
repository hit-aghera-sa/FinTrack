import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TransactionService } from '../core/services/transaction';
import { AuthService } from '../core/services/auth';

const BACKEND_BASE = 'http://localhost:5001'; // change if needed

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
  attachmentsTarget = signal<any | null>(null); // { transactionId: string, attachments: string[] }

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
        const cleaned = (res.data || []).map((t: any) => {
          const type = (t.type || '').toLowerCase();

          const attachments = Array.isArray(t.attachments)
            ? t.attachments.map((p: string) => {
                if (!p) return p;
                if (p.startsWith('http://') || p.startsWith('https://')) return p;
                return `${BACKEND_BASE}${p.startsWith('/') ? '' : '/'}${p}`;
              })
            : [];

          const categoryId = t.categoryId || null;

          return {
            ...t,
            type,
            attachments,
            categoryId,
            description: t.description || ''
          };
        });

        this.transactions.set(cleaned);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load transactions', err);
        this.loading.set(false);
      }
    });
  }

  // Stats
  totalIncome = computed(() =>
    this.transactions().filter(t => t.type === 'income')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0)
  );

  totalExpense = computed(() =>
    this.transactions().filter(t => t.type === 'expense')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0)
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

  // Navigation
  goToAdd() {
    this.router.navigate(['/add-transaction']);
  }

  editTransaction(t: any) {
    this.router.navigate(['/edit-transaction', t._id]);
  }

  // Delete
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
      },
      error: (err) => {
        console.error('delete transaction failed', err);
        this.closeDelete();
      }
    });
  }

  // Note modal
  openNote(t: any) {
    this.noteTarget.set(t);
  }

  closeNote() {
    this.noteTarget.set(null);
  }

  // Attachments modal
  openAttachments(t: any) {
    this.attachmentsTarget.set({
      transactionId: t._id,
      attachments: (t.attachments || []).map((p: string) =>
        p.startsWith("http")
          ? `${p}?t=${Date.now()}`
          : `${BACKEND_BASE}${p}?t=${Date.now()}`
      ),
      title: t.categoryId?.name || 'Attachments'
    });
  }

  closeAttachments() {
    this.attachmentsTarget.set(null);
  }

  logout() {
    this.authService.logout();
  }

  // Replace file
  replaceAttachment(index: number, event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    const t = this.attachmentsTarget();
    const transactionId = t.transactionId;

    const formData = new FormData();
    formData.append('file', file);

    this.transactionService.updateAttachment(transactionId, index, formData)
      .subscribe({
        next: (res) => {
          const updated = [...t.attachments];

          updated[index] = `${BACKEND_BASE}${res.attachments[index]}?t=${Date.now()}`;

          this.attachmentsTarget.set({ ...t, attachments: updated });
        },
        error: (err) => console.error("replace failed", err)
      });
  }

  // Delete file
  deleteAttachment(index: number) {
    const t = this.attachmentsTarget();
    const transactionId = t.transactionId;

    this.transactionService.deleteAttachment(transactionId, index)
      .subscribe({
        next: (res) => {
          const mapped = res.attachments.map(p =>
            `${BACKEND_BASE}${p}?t=${Date.now()}`
          );

          this.attachmentsTarget.set({ ...t, attachments: mapped });
        },
        error: (err) => console.error("delete failed", err)
      });
  }

}
