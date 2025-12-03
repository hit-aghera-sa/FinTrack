import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/services/auth';
import { CategoryService } from '../core/services/category';
import { TransactionService } from '../core/services/transaction';
import { NavbarComponent } from '../shared/navbar/navbar';

interface Transaction {
  amount: number;
  type: string;
  category: string;
  date: string;
  description?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent],
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
   // Flag to prevent multiple loads
  dataLoaded = false;
  categories: any[] = [];
  recentTransactions: Transaction[] = [];
  expenseCategories: any[] = [];

  constructor(
    private router: Router,
    private authService: AuthService,
    private categoryService: CategoryService,
    private transactionService: TransactionService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    console.log("Dashboard init → waiting for session...");
    this.waitForAuthAndLoad();
  }

  // Wait until session is confirmed before loading any data
  waitForAuthAndLoad() {
    this.authService.checkSession().subscribe({
      next: () => {
        console.log("Session OK → loading dashboard...");
        localStorage.setItem('isAuthenticated', 'true');
        this.loadDashboardData();
      },
      error: () => {
        console.log("Session FAIL → redirect login");
        localStorage.removeItem('isAuthenticated');
        this.router.navigate(['/login']);
      }
    });
  }

  loadDashboardData(): void {
    this.loadCategories();
    this.loadTransactions();
  }

  loadCategories(): void {
    this.categoryService.getMyCategories().subscribe({
      next: (res: any) => {
        this.categories = res.data || [];
      }
    });
  }

  loadTransactions(): void {
    // Prevent multiple loads
    if (this.dataLoaded) return; 
    
    this.transactionService.getMyTransactions().subscribe({
      next: (res: any) => {
        console.log('API Response:', res);
        let tx: Transaction[] = [];

        if (Array.isArray(res)) {
          tx = res;
        } else if (res?.data) {
          tx = Array.isArray(res.data) ? res.data : [];
        }

        this.recentTransactions = tx.slice(0, 5);

        const income = tx
          .filter((t: Transaction) => t.type === 'income')
          .reduce((sum: number, t: Transaction) => sum + (Number(t.amount) || 0), 0);

        const expense = tx
          .filter((t: Transaction) => t.type === 'expense')
          .reduce((sum: number, t: Transaction) => sum + (Number(t.amount) || 0), 0);

        const balance = income - expense;

        // Create a new object reference to trigger change detection
        this.financialSummary = {
          totalIncome: income,
          totalExpense: expense,
          balance: balance,
          savingsRate: income > 0 ? Number(((balance / income) * 100).toFixed(1)) : 0
        };

        this.expenseCategories = this.buildExpenseBreakdown(tx);
        this.dataLoaded = true; // Mark as loaded
        
        // Manually trigger change detection
        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('Error loading transactions:', error);
        // Set default values on error
        this.financialSummary = {
          totalIncome: 0,
          totalExpense: 0,
          balance: 0,
          savingsRate: 0
        };
        this.dataLoaded = true;
        this.cdr.detectChanges();
      }
    });
  }

  buildExpenseBreakdown(tx: Transaction[]) {
    const expenses = tx.filter(t => t.type === 'expense');
    const totals: Record<string, number> = {};

    for (const t of expenses) {
      const cat = t.category || 'Uncategorized';
      totals[cat] = (totals[cat] || 0) + Number(t.amount);
    }

    const totalExpense = Object.values(totals).reduce((a, b) => a + b, 0);

    return Object.keys(totals).map(c => ({
      name: c,
      amount: totals[c],
      percentage: totalExpense > 0
        ? Math.round((totals[c] / totalExpense) * 100)
        : 0
    }));
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }
}
