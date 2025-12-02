import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './navbar.html'
})
export class NavbarComponent {
  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  navigate(path: string) {
    this.router.navigate([path]);
  }

  logout() {
    this.auth.logout();
  }
}
