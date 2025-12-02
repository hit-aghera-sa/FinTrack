import { inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth';
import { firstValueFrom } from 'rxjs';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export const authGuard = async (): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const platformId = inject(PLATFORM_ID);

  const isBrowser = isPlatformBrowser(platformId);

  // ONLY run checkSession if localStorage shows user already logged in
  if (isBrowser && localStorage.getItem('isAuthenticated') === 'true') {
    try {
      const res: any = await firstValueFrom(auth.checkSession());

      if (res?.status === 'success') {
        return true; // allow dashboard access
      } else {
        localStorage.removeItem('isAuthenticated');
        return router.createUrlTree(['/login']);
      }
    } catch {
      localStorage.removeItem('isAuthenticated');
      return router.createUrlTree(['/login']);
    }
  }

  // User NOT authenticated locally → block dashboard access
  return router.createUrlTree(['/login']);
};
