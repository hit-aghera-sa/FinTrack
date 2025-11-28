import { inject } from '@angular/core';
import { Routes, Router, UrlTree } from '@angular/router';
import { Signup } from './auth/signup/signup';
import { Login } from './auth/login/login';
import { ForgotPassword } from './auth/forgot-password/forgot-password';
import { Dashboard } from './dashboard/dashboard';
import { authGuard } from './core/guards/auth.guard';
import { AuthService } from './core/services/auth';

export const routes: Routes = [
  { path: '', redirectTo: 'signup', pathMatch: 'full' },

  // LOGIN
  {
    path: 'login',
    component: Login,
    canActivate: [
      (): boolean | UrlTree => {
        const auth = inject(AuthService);
        const router = inject(Router);
        return auth.isAuthenticated()
          ? router.createUrlTree(['/dashboard'])
          : true;
      }
    ]
  },

  // SIGNUP
  {
    path: 'signup',
    component: Signup,
    canActivate: [
      (): boolean | UrlTree => {
        const auth = inject(AuthService);
        const router = inject(Router);
        return auth.isAuthenticated()
          ? router.createUrlTree(['/dashboard'])
          : true;
      }
    ]
  },

  { path: 'forgot-password', component: ForgotPassword },

  // DASHBOARD
  {
    path: 'dashboard',
    component: Dashboard,
    canActivate: [authGuard]
  },

  // ALL CATEGORIES PAGE
  {
    path: 'categories',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./categories/categories').then(m => m.CategoriesPage)
  },

  // ADD CATEGORY PAGE
  {
    path: 'add-category',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./categories/add-category/add-category').then(m => m.AddCategory)
  },

  // EDIT CATEGORY
  {
    path: 'edit-category/:id',
    loadComponent: () =>
      import('./categories/edit-category/edit-category').then(m => m.EditCategory),
    canActivate: [authGuard]
  },

  // ALL TRANSACTIONS PAGE
  {
    path: 'transactions',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./transactions/transactions').then(m => m.TransactionsPage)
  },

  // ADD TRANSACTION PAGE
  {
    path: 'add-transaction',
    loadComponent: () =>
      import('./transactions/add-transaction/add-transaction')
        .then(m => m.AddTransaction),
    canActivate: [authGuard]
  },

  // EDIT TRANSACTION PAGE
  {
    path: 'edit-transaction/:id',
    loadComponent: () =>
      import('./transactions/edit-transaction/edit-transaction')
        .then(m => m.EditTransaction),
    canActivate: [authGuard]
  },

  // FALLBACK
  { path: '**', redirectTo: 'signup' }
];
