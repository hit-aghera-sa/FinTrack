import { Routes, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';

import { authGuard } from './core/guards/auth.guard';
import { AuthService } from './core/services/auth';

function redirectIfLoggedIn(): boolean | UrlTree {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) return true;

  return router.createUrlTree(['/dashboard']);
}

export const routes: Routes = [
  // Default route
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // LOGIN
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login/login').then(m => m.LoginComponent),
    canActivate: [redirectIfLoggedIn]
  },

  // SIGNUP
  {
    path: 'signup',
    loadComponent: () =>
      import('./auth/signup/signup').then(m => m.Signup),
    canActivate: [redirectIfLoggedIn]
  },

  // FORGOT PASSWORD
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./auth/forgot-password/forgot-password').then(m => m.ForgotPassword)
  },

  // DASHBOARD
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard').then(m => m.Dashboard),
    canActivate: [authGuard]
  },

  // CATEGORIES
  {
    path: 'categories',
    loadComponent: () =>
      import('./categories/categories').then(m => m.CategoriesPage),
    canActivate: [authGuard]
  },

  {
    path: 'add-category',
    loadComponent: () =>
      import('./categories/add-category/add-category').then(m => m.AddCategory),
    canActivate: [authGuard]
  },

  {
    path: 'edit-category/:id',
    loadComponent: () =>
      import('./categories/edit-category/edit-category').then(m => m.EditCategory),
    canActivate: [authGuard]
  },

  {
    path: 'transactions',
    loadComponent: () =>
      import('./transactions/transactions').then(m => m.TransactionsPage),
    canActivate: [authGuard]
  },

  {
    path: 'add-transaction',
    loadComponent: () =>
      import('./transactions/add-transaction/add-transaction').then(m => m.AddTransaction),
    canActivate: [authGuard]
  },

  {
    path: 'edit-transaction/:id',
    loadComponent: () =>
      import('./transactions/edit-transaction/edit-transaction').then(m => m.EditTransaction),
    canActivate: [authGuard]
  },

  {
    path: 'reset-password/:token',
    loadComponent: () =>
      import('./auth/reset-password/reset-password').then(m => m.ResetPassword)
  },

  // CATCH-ALL
  { path: '**', redirectTo: 'login' }
];
