import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private api = 'http://localhost:5001/api/user';   // BASE ROUTE
  private isBrowser: boolean;

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  isAuthenticated(): boolean {
    if (!this.isBrowser) return false;
    return localStorage.getItem('isAuthenticated') === 'true';
  }

  saveUser(user: any): void {
    if (!this.isBrowser) return;
    localStorage.setItem('user', JSON.stringify(user));
  }

  logout(): void {
    this.http.post(`${this.api}/logout`, {}, { withCredentials: true })
      .subscribe(() => {
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');
        this.router.navigate(['/login']);
      });
  }

  signup(data: any) {
    return this.http.post(`${this.api}/signup`, data, { withCredentials: true });
  }

  login(data: any) {
    return this.http.post(`${this.api}/login`, data, { withCredentials: true });
  }

  forgotPassword(email: string) {
    return this.http.post(`${this.api}/forgot-password`, { email });
  }

  resetPassword(token: string, passwords: any) {
    return this.http.patch(`${this.api}/reset-password/${token}`, passwords);
  }

  checkSession() {
    return this.http.get(`${this.api}/me`, { withCredentials: true });
  }
}
