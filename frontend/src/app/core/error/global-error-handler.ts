import { ErrorHandler, Injectable, NgZone } from '@angular/core';
import { LoggingService } from '../services/logging.service';
import { Router } from '@angular/router';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(
    private logger: LoggingService,
    private router: Router,
    private zone: NgZone,
  ) {}

  handleError(error: any): void {
    // Log error using your LoggingService
    this.logger.error('Global Error Handler:', error);

    // Example: If error is severe → redirect to a safe page
    this.zone.run(() => {
      // Optional: Navigate
      // this.router.navigate(['/error']);
    });

    // Always rethrow the error so Angular can still display it in dev mode
    throw error;
  }
}
