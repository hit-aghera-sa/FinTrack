import { Injectable } from '@angular/core';
import environment from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class LoggingService {
  info(message: string, meta?: any) {
    if (!environment.production) {
      console.info(message, meta);
    }
    // In production, send to backend logging API (optional)
  }

  warn(message: string, meta?: any) {
    if (!environment.production) {
      console.warn(message, meta);
    }
  }

  error(message: string, meta?: any) {
    if (!environment.production) {
      console.error(message, meta);
    }
  }

  debug(message: string, meta?: any) {
    if (!environment.production) {
      console.debug(message, meta);
    }
  }
}
