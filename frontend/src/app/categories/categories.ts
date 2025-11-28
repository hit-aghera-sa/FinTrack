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

  // Computed values for statistics
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

  // Optional: Add edit functionality
  editCategory(category: any): void {
    // Implement edit functionality
    console.log('Edit category:', category);
  }
}