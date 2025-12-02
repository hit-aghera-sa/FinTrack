import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CategoryService } from '../core/services/category';
import { AuthService } from '../core/services/auth';

@Component({
  selector: 'app-categories-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './categories.html',
  styleUrls: ['./categories.css']
})
export class CategoriesPage implements OnInit {

  categories = signal<any[]>([]);
  loading = signal(true);

  deleteTarget = signal<any | null>(null);

  // Pagination signals
  currentPage = signal(1);
  pageSize = 9;

  incomeCategoriesCount = computed(() =>
    this.categories().filter(cat => cat.type === 'income').length
  );

  expenseCategoriesCount = computed(() =>
    this.categories().filter(cat => cat.type === 'expense').length
  );

  constructor(
    private categoryService: CategoryService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading.set(true);

    this.categoryService.getMyCategories().subscribe({
      next: (res) => {
        this.categories.set(res.data || []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load categories:', err);
        this.loading.set(false);
      }
    });
  }

  goToAdd(): void {
    this.router.navigate(['/add-category']);
  }

  logout(): void {
    this.authService.logout();
  }

  // edit category
  editCategory(cat: any): void {
    this.router.navigate(['/edit-category', cat._id]);
  }

  // delete category modal
  openDelete(cat: any): void {
    this.deleteTarget.set(cat);
  }

  closeDelete(): void {
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const cat = this.deleteTarget();
    if (!cat) return;

    this.categoryService.deleteCategory(cat._id).subscribe({
      next: () => {
        this.categories.set(
          this.categories().filter(c => c._id !== cat._id)
        );
        this.deleteTarget.set(null);
      },
      error: (err) => {
        console.error('Delete failed:', err);
        this.deleteTarget.set(null);
      }
    });
  }

  // Computed: total pages
  totalPages = computed(() => {
    const total = this.categories().length;
    return Math.max(1, Math.ceil(total / this.pageSize));
  });

  // Computed: paginated categories for current page
  paginatedCategories = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.categories().slice(start, end);
  });

  // Go to page
  goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
  }

  // For Next button
  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(v => v + 1);
    }
  }

  // For Prev button
  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update(v => v - 1);
    }
  }
}
