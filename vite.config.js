import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createMemoryCache, handleNytRequest } from "./server/nytProxy.js";

// In sviluppo (npm run dev / preview) le richieste /api/* passano dallo
// stesso proxy usato dalla Netlify Function, con la chiave letta da .env.
function nytApiProxy(apiKey) {
  const cache = createMemoryCache({ ttlMs: 10 * 60 * 1000 });

  async function middleware(req, res) {
    const request = new Request(`http://localhost/api${req.url}`, { method: req.method });
    const response = await handleNytRequest(request, { apiKey, cache });
    res.statusCode = response.status;
    response.headers.forEach((value, name) => res.setHeader(name, value));
    res.end(await response.text());
  }

  return {
    name: "nyt-api-proxy",
    configureServer(server) {
      server.middlewares.use("/api", middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api", middleware);
    },
  };
}

export default defineConfig(({ mode }) => {
  // Senza prefisso VITE_ la variabile non entra mai nel bundle del browser.
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };

  // Caricamento delle mappe sorgente su Sentry: solo in CI, quando il token
  // (GitHub Secret SENTRY_AUTH_TOKEN) è presente. Dopo l'upload le mappe
  // vengono cancellate da dist, così non finiscono sul sito pubblico.
  const uploadSourceMaps = Boolean(env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT);

  return {
    plugins: [
      react(),
      nytApiProxy(env.NYT_API_KEY),
      uploadSourceMaps &&
        sentryVitePlugin({
          authToken: env.SENTRY_AUTH_TOKEN,
          org: env.SENTRY_ORG,
          project: env.SENTRY_PROJECT,
          release: { name: env.VITE_RELEASE },
          sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
          telemetry: false,
        }),
    ],
    build: {
      // Mappe "hidden": generate per Sentry ma non collegate dai file JS.
      sourcemap: "hidden",
      rolldownOptions: {
        output: {
          // React e Sentry cambiano di rado: in file separati restano nella
          // cache del browser anche quando cambia il codice dell'app.
          codeSplitting: {
            groups: [
              { name: "sentry", test: /node_modules[\\/]@sentry/ },
              { name: "react", test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            ],
          },
        },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./tests/setup.js"],
    },
  };
});
