import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Register Chart.js components and plugins once globally.
// Must be imported before any chart component is instantiated.
import './app/shared/chart-config/chart-setup';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
