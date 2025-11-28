import { HttpInterceptorFn } from '@angular/common/http';

export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  // Send cookies ONLY to backend
  if (req.url.startsWith('http://localhost:5001')) {
    req = req.clone({ withCredentials: true });
  }
  return next(req);
};
