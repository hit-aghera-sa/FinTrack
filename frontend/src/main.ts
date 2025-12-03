import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { LoggingService } from './app/core/services/logging.service';

const loggingService = new LoggingService();

bootstrapApplication(App, appConfig)
  .catch((err) => loggingService.error('Bootstrap error', err));
