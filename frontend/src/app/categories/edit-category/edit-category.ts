import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CategoryService } from '../../core/services/category';

@Component({
  selector: 'app-edit-category',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-category.html'
})
export class EditCategory implements OnInit {

  id = '';
  name = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private categoryService: CategoryService
  ) {}

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
        error: err => console.error(err)
      });
  }

  goBack(): void {
    this.router.navigate(['/categories']);
  }
}
