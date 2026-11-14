import { beforeEach, describe, expect, it, vi } from "vitest";

const init = vi.fn();
vi.mock("@sentry/react", () => ({
  init,
  browserTracingIntegration: () => ({ name: "BrowserTracing" }),
}));

const { initMonitoring } = await import("../src/monitoring/sentry.js");

describe("initMonitoring", () => {
  beforeEach(() => init.mockClear());

  it("stays off without a DSN (development and tests send nothing)", () => {
    expect(initMonitoring({ MODE: "development" })).toBe(false);
    expect(init).not.toHaveBeenCalled();
  });

  it("starts Sentry with environment and release from the build", () => {
    const started = initMonitoring({
      VITE_SENTRY_DSN: "https://public@o0.ingest.sentry.io/0",
      VITE_SENTRY_ENVIRONMENT: "staging",
      VITE_RELEASE: "abc1234",
      MODE: "production",
    });

    expect(started).toBe(true);
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://public@o0.ingest.sentry.io/0",
        environment: "staging",
        release: "abc1234",
        sendDefaultPii: false,
      }),
    );
  });

  it("falls back to the Vite mode when no environment is given", () => {
    initMonitoring({ VITE_SENTRY_DSN: "https://public@o0.ingest.sentry.io/0", MODE: "production" });
    expect(init.mock.calls[0][0].environment).toBe("production");
  });
});
