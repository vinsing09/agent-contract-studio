import { describe, it, expect } from "vitest";
import { parseApiError } from "./utils";

describe("parseApiError", () => {
  it("returns plain message when err is a string", () => {
    expect(parseApiError("boom")).toBe("boom");
  });

  it("returns err.message when present and not JSON", () => {
    const err = new Error("network unreachable");
    expect(parseApiError(err)).toBe("network unreachable");
  });

  it("extracts `detail` from FastAPI-style JSON error body", () => {
    const err = new Error(
      'API error 422: {"detail":"Validation failed: version required"}'
    );
    expect(parseApiError(err)).toBe("Validation failed: version required");
  });

  it("falls back to raw message when JSON parse fails", () => {
    const err = new Error("API error 500: internal server error");
    expect(parseApiError(err)).toBe("API error 500: internal server error");
  });
});
