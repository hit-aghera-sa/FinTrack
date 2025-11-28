import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return new Promise(resolve => {
    let tries = 0;

    const check = () => {
      tries++;

      // cookies/localStorage restored?
      if (auth.isAuthenticated()) {
        resolve(true);
        return;
      }

      if (tries >= 10) {
        resolve(router.createUrlTree(['/login']));
        return;
      }

      setTimeout(check, 100);
    };

    check();
  });
};
