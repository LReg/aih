// Runtime configuration — see docker-entrypoint.sh, which renders /config.json from the
// container's actual environment at start. The checked-in frontend/public/config.json is only
// the localhost default used by `npm start`. Never bake these into the build (see Dockerfile):
// the same image must run unmodified in any environment, docker-compose or k8s.
export interface Environment {
  baseUrl: string;
  apiUrl: string;
  authUrl: string;
  clientId: string;
  features: {
    sso: boolean;
    registration: boolean;
  };
}

export const environment: Environment = {
  baseUrl: "http://localhost:4200",
  apiUrl: "http://127.0.0.1:8081",
  authUrl: "https://stratauth.lreg0.de",
  clientId: "mhTPFZTGW4SrreKtMdWSr4DGpa5rRUZewcfqnFbVrX757MYeX0tuNJ39zV4CM",
  features: { sso: true, registration: true },
};

/**
 * Awaited in main.ts, before app.config/app.component are even imported — see the comment there
 * on why a dynamic import is required, not just awaiting this before bootstrapApplication().
 */
export async function loadRuntimeConfig(): Promise<void> {
  const res = await fetch('/config.json');
  Object.assign(environment, await res.json());
}
