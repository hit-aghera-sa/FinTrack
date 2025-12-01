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

  try {
    const res: any = isBrowser
      ? await firstValueFrom(auth.checkSession())
      : null;

    if (res?.status === 'success') {
      if (isBrowser) localStorage.setItem('isAuthenticated', 'true');
      return true;
    }

    if (isBrowser) localStorage.removeItem('isAuthenticated');
    return router.createUrlTree(['/login']);

  } catch {
    if (isBrowser) localStorage.removeItem('isAuthenticated');
    return router.createUrlTree(['/login']);
  }
};
