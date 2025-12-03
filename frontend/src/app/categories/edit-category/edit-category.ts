import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CategoryService } from '../../core/services/category';
import { FormsModule } from '@angular/forms';
import { LoggingService } from '../../core/services/logging.service';

@Component({
  selector: 'app-edit-category',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-category.html'
})
export class EditCategory implements OnInit {

  id = '';
  name = '';

  private loggingService = inject(LoggingService);
  private categoryService = inject(CategoryService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  constructor() {}

  ngOnInit(): void {
    this.id = this.route.snapshot.params['id'];
    this.loadCategory();
  }

  loadCategory(): void {
    const cat = history.state?.category;

    if (cat) {
      this.name = cat.name;
    }
  }

  save(): void {
    this.categoryService.updateCategory(this.id, { name: this.name.trim() })
      .subscribe({
        next: () => this.router.navigate(['/categories']),
        error: (err: Error) => this.loggingService.error('Failed to update category', err)
      });
  }

  goBack(): void {
    this.router.navigate(['/categories']);
  }
}
