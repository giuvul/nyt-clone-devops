// Back end dell'ambiente locale containerizzato (docker compose).
// Espone lo stesso proxy della Netlify Function come piccolo server HTTP Node,
// senza dipendenze: in produzione il proxy gira come function su Netlify, qui
// come servizio "api" dietro a nginx.
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { createMemoryCache, handleNytRequest } from "./nytProxy.js";

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

export function createApiServer({ apiKey, fetchImpl = fetch, cache = createMemoryCache({ ttlMs: 10 * 60 * 1000 }), log = console.info } = {}) {
  return createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url, "http://localhost");

    // Il log contiene solo metodo, percorso e status: mai la query (che per
    // la ricerca è testo dell'utente) e mai l'URL verso il NYT con la chiave.
    res.on("finish", () => log(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`));

    if (url.pathname === "/healthz") {
      // Dice se la chiave è configurata, senza mai restituirla.
      return sendJson(res, 200, { status: "ok", nytKeyConfigured: Boolean(apiKey) });
    }

    if (!url.pathname.startsWith("/api/")) return sendJson(res, 404, { error: "Not found" });

    try {
      const request = new Request(url, { method: req.method });
      const response = await handleNytRequest(request, { apiKey, fetchImpl, cache });
      res.statusCode = response.status;
      response.headers.forEach((value, name) => res.setHeader(name, value));
      res.end(await response.text());
    } catch (error) {
      console.error("Unexpected proxy error:", error.message);
      sendJson(res, 500, { error: "Unexpected server error" });
    }
  });
}

// Avvio solo quando il file è eseguito direttamente (node server/index.js),
// non quando lo importano i test.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const port = Number(process.env.PORT ?? 8787);
  const apiKey = process.env.NYT_API_KEY;
  if (!apiKey) console.warn("NYT_API_KEY is not set: /api/* will answer 500 until it is configured.");

  const server = createApiServer({ apiKey });
  server.listen(port, () => console.info(`NYT API proxy listening on port ${port}`));

  // docker stop invia SIGTERM: chiude le connessioni in modo pulito.
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}
