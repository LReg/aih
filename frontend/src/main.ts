import { bootstrapApplication } from '@angular/platform-browser';
import { loadRuntimeConfig } from './environments/environment';

// app.config.ts reads environment.* into its providers array at module-evaluation time (the
// OIDC provideAuth() config in particular), so it must not be imported — even transitively —
// until loadRuntimeConfig() has resolved. A static top-level import would be hoisted and run
// before this .then() regardless of source order, so app.config/app.component are imported
// dynamically here instead.
loadRuntimeConfig()
  .then(() => Promise.all([import('./app/app.config'), import('./app/app.component')]))
  .then(([{ appConfig }, { AppComponent }]) => bootstrapApplication(AppComponent, appConfig))
  .catch((err) => console.error(err));
