import { describe, expect, it, vi } from "vitest";
import { isStaleRefreshToken, resolveAuthUser, type AuthUserClient } from "./auth-user";
import type { User } from "@supabase/supabase-js";

function userStub(): User {
  return { id: "user-1" } as User;
}

function client(overrides: {
  getUser: AuthUserClient["auth"]["getUser"];
  signOut?: AuthUserClient["auth"]["signOut"];
}): AuthUserClient {
  return {
    auth: {
      getUser: overrides.getUser,
      signOut: overrides.signOut ?? vi.fn(),
    },
  };
}

describe("isStaleRefreshToken", () => {
  it("matches refresh_token_not_found", () => {
    expect(isStaleRefreshToken({ code: "refresh_token_not_found", message: "Invalid Refresh Token" })).toBe(true);
  });

  it("does not match unrelated auth errors", () => {
    expect(isStaleRefreshToken({ code: "invalid_credentials", message: "Invalid login" })).toBe(false);
  });
});

describe("resolveAuthUser", () => {
  it("returns the user when getUser succeeds", async () => {
    const user = userStub();
    const result = await resolveAuthUser(
      client({
        getUser: () => Promise.resolve({ data: { user }, error: null }),
      }),
    );
    expect(result).toEqual(user);
  });

  it("clears a local session when getUser throws refresh_token_not_found", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const result = await resolveAuthUser(
      client({
        getUser: () =>
          Promise.reject(
            Object.assign(new Error("Invalid Refresh Token: Refresh Token Not Found"), {
              code: "refresh_token_not_found",
            }),
          ),
        signOut,
      }),
    );
    expect(result).toBeNull();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("returns null without throwing when getUser returns a stale-token error", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const result = await resolveAuthUser(
      client({
        getUser: () =>
          Promise.resolve({
            data: { user: null },
            error: { code: "refresh_token_not_found", message: "Invalid Refresh Token: Refresh Token Not Found" },
          }),
        signOut,
      }),
    );
    expect(result).toBeNull();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
