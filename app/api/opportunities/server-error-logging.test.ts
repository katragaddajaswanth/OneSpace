import { afterEach, describe, expect, it, vi } from "vitest";
import { logServerError, serverErrorResponse } from "@/lib/server-error-logging";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("server error diagnostics", () => {
  it("logs endpoint, error name and code with sanitized details in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = Object.assign(
      new Error("Connection failed for postgres://user:password@db.example/app?token=secret alice@example.edu userId=student_123"),
      { code: "P2021" }
    );

    logServerError("GET /api/opportunities/saved", error, "prisma_queries");

    expect(logger).toHaveBeenCalledOnce();
    const entry = JSON.parse(logger.mock.calls[0][0] as string) as Record<string, string>;
    expect(entry).toMatchObject({
      event: "api_request_failed",
      endpoint: "GET /api/opportunities/saved",
      stage: "prisma_queries",
      errorName: "Error",
      errorCode: "P2021",
    });
    expect(entry.message).toContain("[redacted-url]");
    expect(entry.message).toContain("[redacted-email]");
    expect(entry.message).not.toContain("password@db.example");
    expect(entry.message).not.toContain("alice@example.edu");
    expect(entry.message).not.toContain("student_123");
  });

  it("omits error messages outside development", () => {
    vi.stubEnv("NODE_ENV", "production");
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logServerError("GET /api/opportunities", new Error("private diagnostic"));

    const entry = JSON.parse(logger.mock.calls[0][0] as string) as Record<string, string>;
    expect(entry.endpoint).toBe("GET /api/opportunities");
    expect(entry.errorName).toBe("Error");
    expect(entry).not.toHaveProperty("message");
    expect(JSON.stringify(entry)).not.toContain("private diagnostic");
  });

  it("returns sanitized structured diagnostics in development API responses", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = Object.assign(
      new Error("Query failed: SELECT email FROM Users WHERE email = 'alice@example.edu'; postgres://user:pass@host/db"),
      { code: "P2021" }
    );

    const response = serverErrorResponse(
      "GET /api/opportunities",
      error,
      "prisma_queries",
      "Opportunities could not be loaded."
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body.message).toBe("Opportunities could not be loaded.");
    expect(body.diagnostic).toMatchObject({
      endpoint: "GET /api/opportunities",
      stage: "prisma_queries",
      errorName: "Error",
      errorCode: "P2021",
    });
    expect(body.diagnostic.message).toContain("[redacted SQL]");
    expect(body.diagnostic.message).not.toContain("SELECT");
    expect(body.diagnostic.message).not.toContain("alice@example.edu");
    expect(body.diagnostic.message).not.toContain("postgres://");
  });

  it("keeps API responses generic and omits diagnostics in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = serverErrorResponse(
      "GET /api/opportunities/saved",
      Object.assign(new Error("private details"), { code: "P2021" }),
      "prisma_queries",
      "Saved opportunities could not be retrieved."
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      success: false,
      message: "Saved opportunities could not be retrieved.",
    });
    expect(JSON.stringify(body)).not.toContain("P2021");
    expect(JSON.stringify(body)).not.toContain("private details");
  });
});
