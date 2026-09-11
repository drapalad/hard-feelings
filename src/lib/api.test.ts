import { describe, expect, it } from "vitest";
import { notFound, unauthorized } from "./api";

describe("unauthorized", () => {
  it("returns 401 JSON and does not redirect", async () => {
    const response = unauthorized();
    expect(response.status).toBe(401);
    expect(response.headers.get("Location")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      error: { code: "UNAUTHORIZED", message: "Sign in required" },
    });
  });
});

describe("notFound", () => {
  it("returns 404 JSON NOT_FOUND and does not redirect", async () => {
    const response = notFound();
    expect(response.status).toBe(404);
    expect(response.headers.get("Location")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "Not found" },
    });
  });
});
