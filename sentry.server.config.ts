import handler from "@astrojs/cloudflare/entrypoints/server";
import * as Sentry from "@sentry/cloudflare";
import { resolveSentryDsn } from "./src/lib/sentry-enabled";

interface WorkerEnv {
  SENTRY_DSN?: string;
  SENTRY_ENABLED?: string;
}

export default Sentry.withSentry((env: WorkerEnv) => {
  return {
    dsn: resolveSentryDsn(env),
    integrations: [Sentry.captureConsoleIntegration({ levels: ["warn", "error"] })],
  };
}, handler);
