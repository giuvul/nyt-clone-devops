// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiServer } from "../server/index.js";

let server;

async function start(options) {
  server = createApiServer({ log: () => {}, ...options });
  await new Promise((resolve) => server.listen(0, resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe("api server (docker compose back end)", () => {
  it("answers the health check without exposing the key", async () => {
    const base = await start({ apiKey: "secret-key-123" });
    const response = await fetch(`${base}/healthz`);
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(JSON.parse(text)).toEqual({ status: "ok", nytKeyConfigured: true });
    expect(text).not.toContain("secret-key-123");
  });

  it("forwards /api/* to the proxy with the key added server side", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200 }));
    const base = await start({ apiKey: "secret-key-123", fetchImpl });

    const response = await fetch(`${base}/api/topstories/home`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ results: [] });
    const upstreamUrl = new URL(fetchImpl.mock.calls[0][0]);
    expect(upstreamUrl.pathname).toBe("/svc/topstories/v2/home.json");
    expect(upstreamUrl.searchParams.get("api-key")).toBe("secret-key-123");
  });

  it("never logs the query string or the key", async () => {
    const log = vi.fn();
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    server = createApiServer({ apiKey: "secret-key-123", fetchImpl, log });
    await new Promise((resolve) => server.listen(0, resolve));
    const base = `http://127.0.0.1:${server.address().port}`;

    await fetch(`${base}/api/search?q=private+words&page=0&sort=newest`);
    await vi.waitFor(() => expect(log).toHaveBeenCalled());

    const line = log.mock.calls[0][0];
    expect(line).toMatch(/^GET \/api\/search 200 \d+ms$/);
    expect(line).not.toContain("secret-key-123");
    expect(line).not.toContain("private");
  });

  it("rejects paths outside /api", async () => {
    const base = await start({ apiKey: "k" });
    const response = await fetch(`${base}/etc/passwd`);
    expect(response.status).toBe(404);
  });
});
