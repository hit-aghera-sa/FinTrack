import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/services/auth';
import { CategoryService } from '../core/services/category';
import { TransactionService } from '../core/services/transaction';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class Dashboard implements OnInit {

  financialSummary = {
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    savingsRate: 0
  };

  categories: any[] = [];
  recentTransactions: any[] = [];
  expenseCategories: any[] = [];

  constructor(
    private router: Router,
    private authService: AuthService,
    private categoryService: CategoryService,
    private transactionService: TransactionService
  ) {}

  ngOnInit(): void {
    this.waitForAuthAndLoad();
  }

  /**
   * Fix: wait for cookies to be restored after a hard refresh.
   * Angular hydration takes 50–150ms before document.cookie becomes readable.
   */
  waitForAuthAndLoad(): void {
    let attempts = 0;
    const maxAttempts = 10; // 10 × 100ms = 1 second max wait

    const check = () => {
      attempts++;

      if (this.authService.isAuthenticated()) {
        // Cookies available → load dashboard
        this.loadDashboardData();
        return;
      }

      if (attempts >= maxAttempts) {
        // Still not authenticated → redirect to login
        this.router.navigate(['/login']);
        return;
      }

      // Try again in 100ms
      setTimeout(check, 100);
    };

    check();
  }

  loadDashboardData(): void {
    this.loadCategories();
    this.loadTransactions();
  }

  // Fetch user categories
  loadCategories(): void {
    this.categoryService.getMyCategories().subscribe({
      next: (res) => {
        this.categories = res.data || [];
      },
      error: (err) => console.error("Category fetch error:", err)
    });
  }

  // Fetch user transactions + generate summary
  loadTransactions(): void {
    this.transactionService.getMyTransactions().subscribe({
      next: (res) => {
        const tx = res.data || [];

        this.recentTransactions = tx.slice(0, 5);

        const income = tx
          .filter((t: any) => t.type === 'income')
          .reduce((sum: any, t: any) => sum + t.amount, 0);

        const expense = tx
          .filter((t: any) => t.type === 'expense')
          .reduce((sum: any, t: any) => sum + t.amount, 0);

        const balance = income - expense;

        this.financialSummary = {
          totalIncome: income,
          totalExpense: expense,
          balance: balance,
          savingsRate: income > 0 ? Number(((balance / income) * 100).toFixed(1)) : 0
        };

        this.expenseCategories = this.buildExpenseBreakdown(tx);
      },
      error: (err) => console.error("Transaction fetch error:", err)
    });
  }

  buildExpenseBreakdown(tx: any[]): any[] {
    const expenses = tx.filter(t => t.type === 'expense');

    const totals: any = {};

    expenses.forEach(t => {
      if (!totals[t.category]) totals[t.category] = 0;
      totals[t.category] += t.amount;
    });

    const totalExpense = Object.values(totals)
      .reduce((a: any, b: any) => a + b, 0);

    return Object.keys(totals).map(c => ({
      name: c,
      amount: totals[c],
      percentage: totalExpense ? Math.round((totals[c] / Number(totalExpense)) * 100) : 0
    }));
  }

  logout(): void {
    this.authService.logout();
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }
}
